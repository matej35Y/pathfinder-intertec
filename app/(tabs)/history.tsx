import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { getHistorySessions, type TrackingSessionRecord } from '@/src/services/db';
import { Ionicons } from '@expo/vector-icons';
import { ACTIVITY_META } from '@/src/constants/activityTypes';

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<TrackingSessionRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      getHistorySessions().then(setSessions);
    }, [])
  );

  return (
    <View className="flex-1 bg-zinc-950 px-5 py-6 pt-16 w-full h-full">
      <View className="flex-row items-center justify-between pb-6 pt-4">
        <Pressable
          onPress={() => router.navigate('/')}
          className="h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 active:opacity-70"
        >
          <Ionicons name="chevron-back" size={24} color="white" />
        </Pressable>
        <Text className="text-[32px] font-extrabold tracking-tight text-white">Activity History</Text>
        <View className="h-12 w-12" />
      </View>

      {sessions.length === 0 ? (
        <View className="flex-1 items-center justify-center -mt-20">
          <Text className="text-base text-zinc-500 font-medium">No recorded activities yet.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const actMeta = item.activityType ? ACTIVITY_META[item.activityType] : null;
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/activity/[id]', params: { id: item.id } })}
                className="rounded-3xl bg-zinc-900 p-5 border border-zinc-800/80 active:scale-[0.98]"
              >
                {/* Card header row */}
                <View className="flex-row justify-between items-center mb-5">
                  <View className="flex-row items-center gap-3 flex-1 mr-3">
                    {/* Activity icon circle — coloured by type */}
                    <View
                      style={actMeta ? { backgroundColor: actMeta.color + '20' } : undefined}
                      className={`h-10 w-10 rounded-full items-center justify-center shrink-0 ${actMeta ? '' : 'bg-zinc-800'}`}
                    >
                      <Ionicons
                        name={actMeta ? actMeta.icon : 'map'}
                        size={18}
                        color={actMeta ? actMeta.color : '#3b82f6'}
                      />
                    </View>

                    {/* Name + date */}
                    <View className="flex-1">
                      <Text
                        numberOfLines={1}
                        className={`text-lg font-semibold ${item.name ? 'text-zinc-100' : 'text-zinc-500'}`}
                      >
                        {item.name ?? 'Untitled Activity'}
                      </Text>
                      <Text className="text-xs font-medium text-zinc-400 mt-0.5">
                        {new Date(item.createdAtMs).toLocaleString('default', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#71717a" />
                </View>

                {/* Divider */}
                <View className="h-[1px] w-full bg-zinc-800/60 mb-4" />

                {/* Stats */}
                <View className="flex-row justify-between pr-4 mt-2">
                  <View>
                    <Text className="text-sm font-medium text-zinc-500 mb-1">Duration</Text>
                    <Text className="text-[28px] font-semibold text-white">
                      {Math.floor(item.durationSec / 60)}:{String(item.durationSec % 60).padStart(2, '0')}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-sm font-medium text-zinc-500 mb-1">Distance</Text>
                    <View className="flex-row items-baseline gap-1">
                      <Text className="text-[28px] font-semibold text-white">
                        {(item.distanceMeters / 1000).toFixed(2)}
                      </Text>
                      <Text className="text-base font-medium text-zinc-500">km</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
