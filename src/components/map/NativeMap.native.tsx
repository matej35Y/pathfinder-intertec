import MapView, { Marker, Polyline, UrlTile, PROVIDER_GOOGLE } from 'react-native-maps';
import { forwardRef, memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

import type { LngLat } from '@/src/types/geo';
import { getMapTilerRasterUrl } from '@/src/config/maptiler';

type Props = {
  mapStyleUrl: string;
  center: LngLat | null;
  routeCoordinates: LngLat[];
  onPanDrag?: () => void;
  onRegionChangeComplete?: () => void;
  mapPadding?: { top?: number; right?: number; bottom?: number; left?: number };
  children?: React.ReactNode;
};

const NativeMapImpl = forwardRef<MapView, Props>(({ center, routeCoordinates, onPanDrag, onRegionChangeComplete, mapPadding, children }, ref) => {
  // Convert [lng, lat] to {latitude, longitude}
  const region = center ? {
    latitude: center[1],
    longitude: center[0],
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : undefined;

  const polylineCoords = routeCoordinates.map(coord => ({
    latitude: coord[1],
    longitude: coord[0],
  }));

  // Render custom API map (MapTiler) ONLY on Android
  // On iOS, we fall back to native Apple Maps to prevent the tile-loading glitch
  const rasterUrl = Platform.OS === 'android' ? getMapTilerRasterUrl() : null;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        toolbarEnabled={false}
        loadingEnabled={true}
        loadingBackgroundColor="#F9FAFB"
        mapPadding={mapPadding}
        moveOnMarkerPress={false}
        onPanDrag={onPanDrag}
        onRegionChangeComplete={onRegionChangeComplete}
        mapType={rasterUrl ? "none" : "standard"}
      >
        {rasterUrl ? (
          <UrlTile
            urlTemplate={rasterUrl}
            maximumZ={19}
            flipY={false}
          />
        ) : null}
        {children}
        {polylineCoords.length > 1 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor="#2563eb"
            strokeWidth={5}
          />
        )}
      </MapView>
    </View>
  );
});

export const NativeMap = memo(NativeMapImpl);

