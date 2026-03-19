import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, Text, View, InteractionManager, ActivityIndicator, Platform, Modal, TouchableOpacity, TextInput, Alert } from 'react-native';
import * as Location from 'expo-location';
import type MapView from 'react-native-maps';
import { Marker, Polyline } from 'react-native-maps';
import { SymbolView } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, withTiming, withRepeat, withSequence, cancelAnimation,
  Easing as ReanimatedEasing, useAnimatedProps, useAnimatedStyle,
  FadeIn, FadeOut, SlideInDown, SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedMarker = Animated.createAnimatedComponent(Marker);
const MemoizedPolyline = React.memo(Polyline);

import { getMapTilerStyleUrl } from '@/src/config/maptiler';
import { NativeMap } from '@/src/components/map/NativeMap';
import { useTrackingSession } from '@/src/hooks/useTrackingSession';
import type { LngLat } from '@/src/types/geo';
import { saveSession } from '@/src/services/db';
import { useTrackingStore } from '@/src/store/trackingStore';

import { ACTIVITY_TYPES } from '@/src/constants/activityTypes';

const getBearing = (start: { latitude: number, longitude: number }, end: { latitude: number, longitude: number }) => {
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const dLon = toRad(end.longitude - start.longitude);
  const lat1 = toRad(start.latitude);
  const lat2 = toRad(end.latitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

export default function TrackingScreen() {
  const insets = useSafeAreaInsets();
  const tracking = useTrackingSession();
  const permission = tracking.permission;
  const [displayStats, setDisplayStats] = useState({ elapsedSec: 0, distanceMeters: 0, startedAtMs: null as number | null, coordinates: [] as LngLat[] });
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [center, setCenter] = useState<LngLat | null>(null);

  // Activity Type State
  const [selectedActivity, setSelectedActivity] = useState(ACTIVITY_TYPES[0]);
  const [isTypePickerVisible, setIsTypePickerVisible] = useState(false);
  const [hasSelectedInitially, setHasSelectedInitially] = useState(false);
  
  // Custom Naming State
  const [sessionName, setSessionName] = useState('Live Session');
  const [isNamingModalVisible, setIsNamingModalVisible] = useState(false);

  // Blink animation shared value
  const blinkValue = useSharedValue(0);

  useEffect(() => {
    // One shared value: 0 → 1 → 0, 900ms each direction
    blinkValue.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: ReanimatedEasing.inOut(ReanimatedEasing.ease) }),
        withTiming(0, { duration: 900, easing: ReanimatedEasing.inOut(ReanimatedEasing.ease) })
      ),
      -1,
      false
    );
  }, []);

  // Ring: full opacity range 0 → 1 in sync with blinkValue
  const blinkRingStyle = useAnimatedStyle(() => ({
    opacity: blinkValue.value,
  }));

  // Label: softer range 0.25 → 1, stays in perfect sync
  const labelFadeStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + blinkValue.value * 0.75,
  }));

  // UI Throttler — High frequency (100ms) for a perfectly smooth clock
  useEffect(() => {
    let interval: any;
    
    const updateStats = () => {
      const s = tracking.getSessionState();
      let liveElapsed = s.elapsedSec;
      
      // If active, calculate elapsed time relative to the literal start time 
      // to avoid any jitter or drift from the interval itself.
      if (tracking.status === 'active' && s.startedAtMs) {
        liveElapsed = Math.floor((Date.now() - s.startedAtMs) / 1000);
      }
      
      setDisplayStats({ 
        elapsedSec: liveElapsed, 
        distanceMeters: s.distanceMeters, 
        startedAtMs: s.startedAtMs, 
        coordinates: s.coordinates 
      });
    };

    if (tracking.status === 'active') {
      // 100ms update frequency makes the timer feel instant and buttery smooth
      interval = setInterval(updateStats, 100);
    } else {
      updateStats();
    }
    
    return () => clearInterval(interval);
  }, [tracking.status, tracking.getSessionState]);

  const mapRef = useRef<MapView>(null);
  const markerLat = useSharedValue(0);
  const markerLng = useSharedValue(0);

  const animatedProps = useAnimatedProps(() => {
    return {
      coordinate: {
        latitude: markerLat.value,
        longitude: markerLng.value,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      } as any
    };
  });

  const isUserInteracting = useRef(false);
  const interactionTimeout = useRef<NodeJS.Timeout | null>(null);
  const isFlingActive = useRef(false);
  const isAnimating = useRef(false);
  const lastCameraUpdate = useRef(0);
  const pendingLocation = useRef<{ latitude: number, longitude: number } | null>(null);

  const handlePanDrag = useCallback(async () => {
    if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
    if (!isUserInteracting.current) {
      isUserInteracting.current = true;
      isFlingActive.current = true;
      try {
        if (mapRef.current) {
          const cam = await mapRef.current.getCamera();
          mapRef.current.animateCamera(cam, { duration: 1 });
        }
      } catch (e) { }
    } else {
      isUserInteracting.current = true;
      isFlingActive.current = true;
    }
  }, []);

  const handleRegionChangeComplete = useCallback(() => {
    if (!isUserInteracting.current) return;
    if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
    interactionTimeout.current = setTimeout(() => {
      isFlingActive.current = false;
      isUserInteracting.current = false;
      if (pendingLocation.current) {
        markerLat.value = withTiming(pendingLocation.current.latitude, { duration: 300, easing: ReanimatedEasing.out(ReanimatedEasing.quad) });
        markerLng.value = withTiming(pendingLocation.current.longitude, { duration: 300, easing: ReanimatedEasing.out(ReanimatedEasing.quad) });
        pendingLocation.current = null;
      }
      if (lastKnownLocation.current && tracking.status === 'active' && !isAnimating.current) {
        const now = Date.now();
        if (now - lastCameraUpdate.current >= 1000) {
          isAnimating.current = true;
          lastCameraUpdate.current = now;
          mapRef.current?.animateToRegion({
            latitude: lastKnownLocation.current.latitude,
            longitude: lastKnownLocation.current.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 1000);
          setTimeout(() => { isAnimating.current = false; }, 1000);
        }
      }
    }, 4000);
  }, [tracking.status]);

  const lastKnownLocation = useRef<{ latitude: number, longitude: number } | null>(null);
  const prevLocation = useRef<{ latitude: number, longitude: number } | null>(null);
  const progressValue = useSharedValue(0);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    if (permission.status !== 'granted') return;

    (async () => {
      try {
        let initial = await Location.getLastKnownPositionAsync();
        if (!initial) {
          initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        if (cancelled) return;
        const initLoc = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
        setCenter([initLoc.longitude, initLoc.latitude]);
        markerLat.value = initLoc.latitude;
        markerLng.value = initLoc.longitude;
        lastKnownLocation.current = initLoc;

        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 1, timeInterval: 1000 },
          (pos) => {
            const currentLoc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            if (isFlingActive.current) {
              pendingLocation.current = currentLoc;
              return;
            }
            if (!lastKnownLocation.current) {
              lastKnownLocation.current = currentLoc;
              markerLat.value = currentLoc.latitude;
              markerLng.value = currentLoc.longitude;
              return;
            }
            prevLocation.current = lastKnownLocation.current;
            lastKnownLocation.current = currentLoc;
            const duration = 1000;
            progressValue.value = 0;
            progressValue.value = withTiming(1, { duration, easing: ReanimatedEasing.linear });
            markerLat.value = withTiming(currentLoc.latitude, { duration, easing: ReanimatedEasing.out(ReanimatedEasing.quad) });
            markerLng.value = withTiming(currentLoc.longitude, { duration, easing: ReanimatedEasing.out(ReanimatedEasing.quad) });
            if (!isUserInteracting.current && tracking.status === 'active' && !isAnimating.current) {
              const now = Date.now();
              if (now - lastCameraUpdate.current >= 1000) {
                isAnimating.current = true;
                lastCameraUpdate.current = now;
                mapRef.current?.animateToRegion({
                  latitude: currentLoc.latitude,
                  longitude: currentLoc.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }, 1000);
                setTimeout(() => { isAnimating.current = false; }, 1000);
              }
            }
          }
        );
      } catch (e) {
        if (!cancelled) {
          setLocateError(e instanceof Error ? e.message : 'Failed to fetch current location.');
        }
      }
    })();
    return () => {
      cancelled = true;
      if (sub) sub.remove();
      if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
    };
  }, [permission.status, tracking.status]);

  useEffect(() => {
    let rafId: number;
    const loop = () => {
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const mapStyleUrl = useMemo(() => {
    try {
      return getMapTilerStyleUrl();
    } catch (e) {
      return "";
    }
  }, []);

  const handleLocateUser = async () => {
    if (isLocating) return;
    try {
      let locRef = lastKnownLocation.current;
      let isInitialJump = false;
      if (!locRef) {
        setIsLocating(true);
        isInitialJump = true;
        setLocateError(null);
        let pos = await Location.getLastKnownPositionAsync();
        if (!pos) {
          pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        locRef = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }
      if (!locRef) return;
      isUserInteracting.current = false;
      InteractionManager.runAfterInteractions(() => {
        mapRef.current?.animateToRegion({
          latitude: locRef!.latitude,
          longitude: locRef!.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, isInitialJump ? 1000 : 400);
      });
    } catch (e) {
      setLocateError(e instanceof Error ? e.message : 'Failed to fetch current location.');
    } finally {
      setIsLocating(false);
    }
  };

  const userMarkerChild = useMemo(() => (
    <AnimatedMarker animatedProps={animatedProps} coordinate={{ latitude: 0, longitude: 0 }}>
      <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-500/30">
        <View className="h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
      </View>
    </AnimatedMarker>
  ), [animatedProps]);

  const polylineChild = useMemo(() => {
    return displayStats.coordinates.length > 1 ? (
      <MemoizedPolyline
        coordinates={displayStats.coordinates.map(c => ({
          latitude: c[1],
          longitude: c[0]
        }))}
        strokeColor="#2563eb"
        strokeWidth={5}
      />
    ) : null;
  }, [displayStats.coordinates]);

  return (
    <View className="flex-1 bg-white dark:bg-black w-full h-full">
      {permission.status === 'checking' ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base opacity-70 text-black dark:text-white">Checking permissions…</Text>
        </View>
      ) : permission.status === 'denied' ? (
        <View className="flex-1 items-center justify-center px-6 pt-24">
          <Text className="text-lg font-semibold text-black dark:text-white">Location permission needed</Text>
          <Text className="mt-2 text-center opacity-70 text-black dark:text-white">Enable location to show your position on the map and start tracking routes.</Text>
          <View className="mt-5 w-full max-w-sm gap-3">
            <Pressable
              className="h-12 items-center justify-center rounded-2xl bg-black px-4 dark:bg-white"
              disabled={!permission.canAskAgain}
              onPress={async () => {
                const granted = await tracking.requestPermission();
                if (!granted && !permission.canAskAgain) {
                  await Linking.openSettings();
                }
              }}>
              <Text className="text-base font-semibold text-white dark:text-black">{permission.canAskAgain ? 'Allow location' : 'Open settings'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-1">
          <NativeMap
            ref={mapRef as any}
            mapStyleUrl={mapStyleUrl}
            center={center ?? undefined as any}
            routeCoordinates={displayStats.coordinates}
            onPanDrag={handlePanDrag}
            onRegionChangeComplete={handleRegionChangeComplete}
            mapPadding={{ top: insets.top + 10, bottom: 0, left: 0, right: 0 }}
          >
            {polylineChild}
            {userMarkerChild}
          </NativeMap>

          {/* Top Logo / Header */}
          <View style={{ paddingTop: insets.top + 10 }} className="absolute top-0 left-0 right-0 items-center justify-center">
            <View className="flex-row items-center bg-white/90 dark:bg-black/90 px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-lg backdrop-blur-md">
              <View className="bg-blue-600 rounded-lg p-1 mr-2 shadow-sm">
                <Ionicons name="navigate" size={18} color="white" />
              </View>
              <Text className="text-lg font-bold tracking-tight text-black dark:text-white">PathFinder</Text>
            </View>
          </View>

          {/* Floating Action Buttons Group */}
          <View className="absolute right-5 bottom-[308px] gap-3">

            {/* Locate User Button — on top as before */}
            <Pressable
              className="h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur dark:bg-zinc-800/90 border border-zinc-200/50 dark:border-zinc-700/50"
              onPress={handleLocateUser}
              disabled={isLocating}
            >
              {isLocating ? (
                <ActivityIndicator color="#2563eb" size="small" />
              ) : Platform.OS === 'ios' ? (
                <SymbolView name="location.fill" size={21.5} tintColor="#2563eb" />
              ) : (
                <Ionicons name="navigate" size={24} color="#2563eb" />
              )}
            </Pressable>

            {/* Activity Selection Button — below locate, with gentle blink ring */}
            <View className="items-center">
              <View className="relative items-center justify-center">
                {/* Condition-based rendering: If user clicked, this entire block DISAPPEARS from the app */}
                {!hasSelectedInitially && (
                  <Animated.View
                    style={[
                      blinkRingStyle,
                      {
                        position: 'absolute',
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        borderWidth: 2,
                        borderColor: selectedActivity.color,
                      },
                    ]}
                  />
                )}
                {/* The button */}
                <Pressable
                  className="h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur dark:bg-zinc-800/90 border border-zinc-200/50 dark:border-zinc-700/50"
                  onPress={() => {
                    setHasSelectedInitially(true);
                    setIsTypePickerVisible(true);
                  }}
                >
                  <Ionicons name={selectedActivity.icon} size={22} color={selectedActivity.color} />
                </Pressable>
              </View>

              {/* Small label below the button - absolutely positioned so it doesn't move the buttons when removed */}
              {!hasSelectedInitially && (
                <Animated.View 
                  style={[labelFadeStyle, { position: 'absolute', top: 48, width: 60 }]} 
                  className="items-center"
                >
                  <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                    Choose
                  </Text>
                </Animated.View>
              )}
            </View>

          </View>

          {/* Live Session Info Card */}
          <View className="absolute bottom-0 left-0 right-0 px-5 pb-28">
            <View className="rounded-3xl bg-white/85 p-4 shadow-lg backdrop-blur-3xl dark:bg-black dark:border-2 dark:border-zinc-900/50">
              <View className="flex-row items-center justify-between">
                <Pressable onPress={() => setIsNamingModalVisible(true)} className="flex-1 mr-4">
                   <Text className="text-xl font-bold text-black dark:text-white" numberOfLines={1}>
                     {sessionName || 'Live Session'}
                   </Text>
                   <Text className="text-[10px] uppercase tracking-tighter text-zinc-400 dark:text-zinc-500 -mt-0.5">TAP TO NAME ACTIVITY</Text>
                </Pressable>
                <View className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                  <Text className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400">{selectedActivity.label}</Text>
                </View>
              </View>

              {tracking.error || locateError ? (
                <Text className="mt-1 text-red-600 dark:text-red-400">{tracking.error || locateError}</Text>
              ) : null}

              <View className="mt-3 flex-row justify-between">
                <View>
                  <Text className="text-xs uppercase tracking-wider opacity-60 text-black dark:text-white">Duration</Text>
                  <Text className="mt-1 text-2xl font-semibold text-black dark:text-white">
                    {Math.floor(displayStats.elapsedSec / 60).toString().padStart(2, '0')}:{(displayStats.elapsedSec % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
                <View>
                  <Text className="text-xs uppercase tracking-wider opacity-60 text-black dark:text-white">Distance</Text>
                  <Text className="mt-1 text-2xl font-semibold text-black dark:text-white">{(displayStats.distanceMeters / 1000).toFixed(2)} km</Text>
                </View>
              </View>

              <View className="mt-5 flex-row gap-3">
                <Pressable
                  className="flex-1 h-14 items-center justify-center rounded-full bg-[#0A84FF] shadow-sm shadow-blue-500/20 active:bg-blue-700"
                  disabled={tracking.status === 'starting' || tracking.status === 'active'}
                  onPress={tracking.startTracking}>
                  <Text className="text-[17px] font-bold text-white tracking-wide">
                    {tracking.status === 'starting' ? 'Starting…' : 'Start'}
                  </Text>
                </Pressable>
                <Pressable
                  className="flex-1 h-14 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 active:bg-black/10 dark:active:bg-white/20"
                  disabled={tracking.status !== 'active'}
                  onPress={async () => {
                    // Snapshot state BEFORE stopping (avoids async race)
                    const finalState = tracking.getSessionState();
                    tracking.stopTracking();
                    if (finalState.coordinates.length > 0) {
                      try {
                        await saveSession(
                          finalState.distanceMeters,
                          finalState.elapsedSec,
                          finalState.coordinates,
                          finalState.startedAtMs || Date.now(),
                          sessionName,
                          selectedActivity.id
                        );
                        // Reset name for next session
                        setSessionName('Live Session');
                        tracking.resetTracking();
                      } catch (err) {
                        useTrackingStore.getState().setError('Failed to save session.');
                      }
                    } else {
                      Alert.alert('Nothing recorded', 'No route was captured. Start moving first!');
                      tracking.resetTracking();
                    }
                  }}>
                  <Text className="text-[17px] font-bold text-black dark:text-white tracking-wide">Stop & Save</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Activity Type Picker Modal */}
          <Modal
            visible={isTypePickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setIsTypePickerVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              className="flex-1 bg-black/60 items-center justify-center px-8"
              onPress={() => setIsTypePickerVisible(false)}
            >
              <Animated.View
                entering={FadeIn.duration(200)}
                className="w-full bg-zinc-950 rounded-[40px] p-8 border border-zinc-800 shadow-2xl"
                // Prevent tap propagation to background
                onTouchEnd={(e) => e.stopPropagation()}
              >
                <Text className="text-2xl font-bold text-white text-center mb-8">Choose Activity</Text>

                <View className="gap-4">
                  {ACTIVITY_TYPES.map((type) => (
                    <Pressable
                      key={type.id}
                      onPress={() => {
                        setSelectedActivity(type);
                        setIsTypePickerVisible(false);
                      }}
                      className={`flex-row items-center p-5 rounded-3xl border ${selectedActivity.id === type.id
                          ? 'bg-zinc-900 border-zinc-700'
                          : 'bg-transparent border-transparent'
                        } active:bg-zinc-900/50`}
                    >
                      <View
                        style={{ backgroundColor: type.color + '20' }}
                        className="h-14 w-14 rounded-2xl items-center justify-center mr-5"
                      >
                        <Ionicons name={type.icon} size={28} color={type.color} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xl font-bold text-white">{type.label}</Text>
                        <Text className="text-sm text-zinc-500">Track your {type.label.toLowerCase()} stats</Text>
                      </View>
                      {selectedActivity.id === type.id && (
                        <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
                      )}
                    </Pressable>
                  ))}
                </View>

                {/* Close Button */}
                <Pressable
                  onPress={() => setIsTypePickerVisible(false)}
                  className="mt-8 h-16 items-center justify-center rounded-3xl bg-zinc-900 border border-zinc-800 active:opacity-80"
                >
                  <Text className="text-base font-bold text-white">Cancel</Text>
                </Pressable>
              </Animated.View>
            </TouchableOpacity>
          </Modal>

          {/* Activity Name Editor Modal */}
          <Modal
            visible={isNamingModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setIsNamingModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              className="flex-1 bg-black/80 items-center justify-center px-6"
              onPress={() => setIsNamingModalVisible(false)}
            >
              <Animated.View
                entering={FadeIn.duration(200)}
                className="w-full bg-zinc-950 rounded-[30px] p-6 border border-zinc-800 shadow-2xl"
              >
                <Text className="text-xl font-bold text-white mb-2">Give it a Title</Text>
                <Text className="text-sm text-zinc-500 mb-6">Describe your route or give this session a special name.</Text>

                <View className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 mb-6">
                  <TextInput
                    value={sessionName}
                    onChangeText={setSessionName}
                    placeholder="Morning Run etc."
                    placeholderTextColor="#52525b"
                    autoFocus
                    className="text-lg font-semibold text-white"
                  />
                </View>

                <Pressable
                  onPress={() => setIsNamingModalVisible(false)}
                  className="h-14 items-center justify-center rounded-2xl bg-[#0A84FF] active:bg-blue-700 shadow-lg shadow-blue-500/10"
                >
                  <Text className="text-base font-bold text-white">Set Name</Text>
                </Pressable>
              </Animated.View>
            </TouchableOpacity>
          </Modal>
        </View>
      )}
    </View>
  );
}
