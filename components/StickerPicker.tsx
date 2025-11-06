import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useMemo, useState } from 'react';
import { Image, SectionList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, IconButton, Modal, Portal, Searchbar, Surface, Text, useTheme } from 'react-native-paper';
import assetManifest from './stickerManifest';

function VideoPreview({ source, style }: { source: any; style?: any }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={style} contentFit="contain" nativeControls={true} />;
}

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (id: string) => void;
};

const StickerPicker = ({ visible, onDismiss, onSelect }: Props) => {
  const theme = useTheme();
  const [query, setQuery] = useState<string>('');
  const [previewId, setPreviewId] = useState<string | null>(null);

  const stickersByPack = useMemo(() => {
    // include both static stickers and video stickers
    const entries = Object.entries(assetManifest).filter(([, v]) => v.type === 'sticker' || v.type === 'video');
  const grouped: Record<string, Array<{ id: string; label?: string; source: any; thumb?: any; isVideo?: boolean }>> = {};
    entries.forEach(([id, item]) => {
      const pack = item.pack ?? id.split('/')[0] ?? 'default';
      const label = item.label ?? id.split('/').slice(1).join('/');
      if (!grouped[pack]) grouped[pack] = [];
      grouped[pack].push({ id, label, source: item.source, thumb: (item as any).thumb, isVideo: (item as any).type === 'video' });
    });

    // Apply search filter working on pack names first (case-insensitive).
    const packs = Object.keys(grouped).sort();
    const q = query.trim().toLowerCase();
    if (!q) {
      return packs.map(pack => ({ pack, items: grouped[pack] }));
    }

    // Find packs whose name matches the query
    const matchingPacks = packs.filter((pack) => pack.toLowerCase().includes(q));
    if (matchingPacks.length > 0) {
      // If there are matching packs, show those packs (all their stickers)
      return matchingPacks.map(pack => ({ pack, items: grouped[pack] }));
    }

    // Fallback: if no pack matches, search sticker ids/labels across packs
    const filtered: Array<{ pack: string; items: Array<any> }> = packs.map(pack => ({ pack, items: grouped[pack].filter(i => i.id.toLowerCase().includes(q) || (i.label && i.label.toLowerCase().includes(q)) ) }));
    return filtered.filter(p => p.items.length > 0);
  }, [query]);

  // Helper: chunk an array into rows of `size`
  const chunk = (arr: any[], size: number) => {
    const chunks: any[] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  };

  // Convert to SectionList sections where each item is a row (array of up to 4 stickers)
  const sections = useMemo(() => {
    return stickersByPack.map(s => ({ title: s.pack, data: chunk(s.items, 4) }));
  }, [stickersByPack]);

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
        <Surface style={styles.header} elevation={1}>
          <Text style={styles.title}>Stickers</Text>
          <IconButton icon="close" onPress={onDismiss} accessibilityLabel="Close sticker picker" />
        </Surface>

        <View style={styles.searchRow}>
          <Searchbar placeholder="Search stickers" onChangeText={setQuery} value={query} style={styles.search} />
        </View>

        {sections.length === 0 ? (
          <View style={styles.empty}><Text>No stickers found</Text></View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(row, index) => row.map((i: any) => i.id).join('-') + '-' + index}
            renderSectionHeader={({ section }) => (
              <View style={styles.packSection}>
                <Text style={styles.packTitle}>{(section as any).title}</Text>
              </View>
            )}
            renderItem={({ item: row }) => (
              <View style={styles.row}>
                {row.map((it: any) => (
                  <TouchableOpacity
                    key={it.id}
                    onPress={() => onSelect(it.id)}
                    onLongPress={() => setPreviewId(it.id)}
                    accessibilityLabel={`Sticker ${it.label ?? it.id}`}
                    style={styles.thumbContainer}
                  >
                    <Image source={it.thumb ?? it.source} style={styles.thumb} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            stickySectionHeadersEnabled={false}
            initialNumToRender={8}
            maxToRenderPerBatch={12}
            windowSize={5}
            removeClippedSubviews={true}
            contentContainerStyle={{ paddingBottom: 8, paddingHorizontal: 12 }}
          />
        )}

        {/* Preview overlay */}
        <Portal>
            <Modal visible={!!previewId} onDismiss={() => setPreviewId(null)} contentContainerStyle={[styles.previewModal, { backgroundColor: theme.colors.surface }]}> 
            {previewId && (
              <View style={styles.previewContent}>
                {assetManifest[previewId].type === 'video' ? (
                  <VideoPreview source={assetManifest[previewId].source} style={styles.previewImage} />
                ) : (
                  <Image source={assetManifest[previewId].source} style={styles.previewImage} />
                )}
                <View style={styles.previewButtons}>
                  <Button mode="contained" onPress={() => { onSelect(previewId); setPreviewId(null); onDismiss(); }}>Send</Button>
                  <Button mode="text" onPress={() => setPreviewId(null)}>Close</Button>
                </View>
              </View>
            )}
          </Modal>
        </Portal>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    padding: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    alignSelf: 'stretch',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8 },
  title: { fontSize: 18, fontWeight: '600', marginLeft: 8 },
  searchRow: { paddingHorizontal: 12, paddingBottom: 8 },
  search: { elevation: 0 },
  content: { paddingHorizontal: 12 },
  packSection: { marginBottom: 12 },
  packTitle: { fontSize: 14, marginVertical: 8, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  thumbContainer: { flex: 1 / 4, padding: 6, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 96, height: 96, borderRadius: 8 },
  empty: { padding: 16, alignItems: 'center' },
  previewModal: { padding: 12, marginHorizontal: 24, borderRadius: 12, alignItems: 'center' },
  previewContent: { alignItems: 'center' },
  previewImage: { width: 220, height: 220, marginBottom: 12 },
  previewButtons: { flexDirection: 'row', gap: 12 },
});

export default StickerPicker;
