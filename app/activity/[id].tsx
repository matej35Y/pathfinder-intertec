import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { NativeMap } from '@/src/components/map/NativeMap';
import { getMapTilerStyleUrl } from '@/src/config/maptiler';
import {
  deleteSession,
  getSessionById,
  type TrackingSessionRecord,
  updateSessionName,
} from '@/src/services/db';
import { Ionicons } from '@expo/vector-icons';
import { ACTIVITY_META } from '@/src/constants/activityTypes';

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<TrackingSessionRecord | null>(null);

  // Edit-name modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      getSessionById(id).then(setSession);
    }
  }, [id]);

  const mapStyleUrl = useMemo(() => {
    try {
      return getMapTilerStyleUrl();
    } catch {
      return '';
    }
  }, []);

  // ── handlers ──────────────────────────────────────────────────────────────

  const openEditModal = () => {
    setNameInput(session?.name ?? '');
    setEditModalVisible(true);
  };

  const handleSaveName = async () => {
    if (!session) return;
    setSaving(true);
    await updateSessionName(session.id, nameInput);
    const updated = await getSessionById(session.id);
    setSession(updated);
    setSaving(false);
    setEditModalVisible(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Activity',
      'Are you sure you want to permanently delete this activity? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!session) return;
            await deleteSession(session.id);
            router.back();
          },
        },
      ]
    );
  };

  // ── loading state ──────────────────────────────────────────────────────────

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Stack.Screen options={{ headerShown: false }} />
      </View>
    );
  }

  const center = session.coordinates.length > 0 ? session.coordinates[0] : null;
  const displayName = session.name ?? 'Untitled Activity';
  const formattedDate = new Date(session.createdAtMs).toLocaleString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const actMeta = session.activityType ? ACTIVITY_META[session.activityType] : null;

  return (
    <View className="flex-1 bg-black relative">
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Overlay header - Balanced layout with history screen ────────── */}
      <View
        // Reduced gap and side padding as requested (gap-2, px-4)
        className="absolute top-0 left-0 right-0 z-10 px-4 pt-20 pb-3 flex-row items-center gap-2"
      >
        <Pressable
          onPress={() => router.back()}
          className="h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 active:opacity-70"
        >
          <Ionicons name="chevron-back" size={24} color="white" />
        </Pressable>

        {/* Route Replay pill - Balanced to match h-12 button, reduced letter spacing */}
        <View className="h-12 items-center justify-center rounded-full bg-zinc-900 px-5 border border-zinc-800">
          <Text className="text-sm font-bold text-white uppercase tracking-tight">
            Route Replay
          </Text>
        </View>
      </View>

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <View className="flex-1 bg-black items-center justify-center">
        <NativeMap
          mapStyleUrl={mapStyleUrl}
          center={center as any}
          routeCoordinates={session.coordinates}
        />
      </View>

      {/* ── Bottom info card ─────────────────────────────────────────────── */}
      <View className="absolute bottom-0 left-0 right-0 px-5 pb-8">
        <View className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
          {/* Activity name + type badge + date */}
          <View className="mb-5 flex-row items-start justify-between">
            <View className="flex-1 mr-3">
              <Text
                numberOfLines={1}
                className="text-[22px] font-bold tracking-tight text-white"
              >
                {displayName}
              </Text>
              <Text className="mt-1 text-xs font-medium text-zinc-400">
                {formattedDate}
              </Text>
            </View>

            {/* Activity type pill */}
            {actMeta && (
              <View
                style={{ backgroundColor: actMeta.color + '18', borderColor: actMeta.color + '50' }}
                className="flex-row items-center gap-1.5 px-3 py-2 rounded-2xl border mt-1"
              >
                <Ionicons name={actMeta.icon} size={14} color={actMeta.color} />
                <Text style={{ color: actMeta.color }} className="text-xs font-bold uppercase tracking-wide">
                  {actMeta.label}
                </Text>
              </View>
            )}
          </View>

          {/* Stats row */}
          <View className="flex-row justify-between mb-6">
            <View>
              <Text className="text-xs uppercase tracking-wider text-white opacity-50">
                Duration
              </Text>
              <Text className="mt-1 text-2xl font-semibold text-white">
                {Math.floor(session.durationSec / 60)}m {session.durationSec % 60}s
              </Text>
            </View>
            <View>
              <Text className="text-xs uppercase tracking-wider text-white opacity-50">
                Distance
              </Text>
              <Text className="mt-1 text-2xl font-semibold text-white">
                {(session.distanceMeters / 1000).toFixed(2)} km
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View className="h-[1px] w-full bg-zinc-800 mb-5" />

          {/* Action buttons */}
          <View className="flex-row gap-3">
            {/* Edit Name */}
            <Pressable
              onPress={openEditModal}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-3.5 border border-zinc-800 active:opacity-70"
            >
              <Ionicons name="pencil-outline" size={17} color="#3b82f6" />
              <Text className="text-sm font-semibold text-blue-400">
                Edit Name
              </Text>
            </Pressable>

            {/* Delete */}
            <Pressable
              onPress={handleDelete}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-3.5 border border-zinc-800 active:opacity-70"
            >
              <Ionicons name="trash-outline" size={17} color="#ef4444" />
              <Text className="text-sm font-semibold text-red-400">
                Delete
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Edit Name Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <Pressable
            className="flex-1 justify-end bg-black/70"
            onPress={() => setEditModalVisible(false)}
          >
            {/* Sheet */}
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View className="rounded-t-3xl bg-zinc-950 px-6 pt-6 pb-10 border-t border-zinc-800">
                {/* Handle bar */}
                <View className="w-10 h-1 rounded-full bg-zinc-800 self-center mb-6" />

                <Text className="text-xl font-bold text-white mb-1">
                  Activity Name
                </Text>
                <Text className="text-sm text-zinc-500 mb-5">
                  Give this workout a memorable name.
                </Text>

                <View className="rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-3 mb-5">
                  <TextInput
                    value={nameInput}
                    onChangeText={setNameInput}
                    placeholder="e.g. Morning Run, Trail Hike…"
                    placeholderTextColor="#71717a"
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveName}
                    maxLength={64}
                    className="text-base text-white"
                  />
                </View>

                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => setEditModalVisible(false)}
                    className="flex-1 items-center justify-center rounded-2xl bg-zinc-900 py-4 active:opacity-70"
                  >
                    <Text className="text-sm font-semibold text-zinc-400">
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveName}
                    disabled={saving}
                    className="flex-1 items-center justify-center rounded-2xl bg-blue-600 py-4 active:opacity-80"
                  >
                    <Text className="text-sm font-semibold text-white">
                      {saving ? 'Saving…' : 'Save'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
