import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, useColorScheme, LayoutAnimation, Platform, UIManager, Alert, Pressable, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { initDatabase, getActivitiesByDate, deleteActivities, getAllActivities, toggleActivityCompletion } from '../src/db/database';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- CONFIG ---
const ITEM_HEIGHT = 40; 
const LOOPS = 300; 

const DateWheel = ({ currentDate, onDateChange, isDark }) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);
  const months = moment.monthsShort(); 
  
  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: getDaysInMonth(currentDate) }, (_, i) => i + 1);

  const activeColor = isDark ? '#FFFFFF' : '#000000';
  const passiveColor = isDark ? '#636366' : '#AEAEB2'; 

  const updateDate = (type, val) => {
    const newDate = new Date(currentDate);
    if (type === 'day') newDate.setDate(val);
    if (type === 'month') newDate.setMonth(months.indexOf(val));
    if (type === 'year') newDate.setFullYear(val);
    onDateChange(newDate);
  };

  const RenderWheel = ({ data, selected, type, infinite = false }) => {
    const flatListRef = useRef(null);
    const renderData = useMemo(() => infinite ? Array.from({ length: LOOPS }, () => data).flat() : ['', ...data, ''], [data, infinite]);

    const initialIndex = useMemo(() => infinite ? (Math.floor(LOOPS / 2) * data.length) + data.indexOf(selected) - 1 : data.indexOf(selected), []);

    const settleWheel = (e) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const roundedIndex = Math.round(offsetY / ITEM_HEIGHT) + 1;
      if (renderData[roundedIndex] !== undefined && renderData[roundedIndex] !== selected) {
         if (renderData[roundedIndex] !== '') updateDate(type, renderData[roundedIndex]);
      }
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: (roundedIndex - 1) * ITEM_HEIGHT, animated: true });
      }
    };

    return (
      <View style={styles.wheelColumn}>
        <View style={[styles.wheelHighlight, { top: ITEM_HEIGHT }]} />
        <FlatList
          ref={flatListRef}
          data={renderData}
          keyExtractor={(_, i) => type + i}
          showsVerticalScrollIndicator={false}
          decelerationRate={0.97} 
          snapToInterval={undefined} 
          getItemLayout={(d, i) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * i, index: i })}
          initialScrollIndex={initialIndex}
          onMomentumScrollEnd={settleWheel}
          onScrollEndDrag={(e) => {
             if (e.nativeEvent.velocity && e.nativeEvent.velocity.y === 0) settleWheel(e);
          }}
          windowSize={5} initialNumToRender={15} maxToRenderPerBatch={10}
          renderItem={({ item }) => {
             if (item === '') return <View style={{ height: ITEM_HEIGHT }} />;
             const isSelected = item === selected;
             return (
               <TouchableOpacity 
                  style={[styles.wheelItem, { opacity: isSelected ? 1 : 0.5, transform: [{ scale: isSelected ? 1.05 : 0.95 }] }]} 
                  activeOpacity={1} 
                  onPress={() => updateDate(type, item)}
               >
                 <Text style={{ fontSize: 17, fontWeight: isSelected ? '700' : '500', color: isSelected ? activeColor : passiveColor }}>
                   {item}
                 </Text>
               </TouchableOpacity>
             );
          }}
        />
      </View>
    );
  };

  return (
    <View style={styles.wheelContainer}>
      <RenderWheel data={days} selected={currentDate.getDate()} type="day" infinite />
      <RenderWheel data={months} selected={months[currentDate.getMonth()]} type="month" infinite />
      <RenderWheel data={years} selected={currentDate.getFullYear()} type="year" infinite={false} />
    </View>
  );
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [activities, setActivities] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const theme = {
    bg: isDark ? '#000000' : '#F2F2F7',
    text: isDark ? '#FFFFFF' : '#000000',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    subText: '#8E8E93',
    border: isDark ? '#38383A' : '#E5E5EA',
    accent: '#007AFF',
    danger: '#FF3B30',
    arrowBg: isDark ? '#1C1C1E' : '#E5E5EA',
    quoteText: isDark ? '#555' : '#AAA',
    doneBtn: isDark ? '#1C1C1E' : '#FFFFFF', 
    checkCircle: isDark ? '#38383A' : '#C7C7CC',
  };

  useEffect(() => { initDatabase(); }, []);
  useFocusEffect(useCallback(() => { loadData(); }, [currentDate]));

  const loadData = async () => {
    try {
      const data = await getActivitiesByDate(currentDate.getTime());
      setActivities(data);
    } catch (e) { console.error(e); }
  };

  const handleExport = async () => {
    try {
        const allData = await getAllActivities();
        if (allData.length === 0) { Alert.alert("No Data", "Log some activities first."); return; }

        let csv = 'Date,Time,Activity,Duration (Min),Status,Notes\n';
        allData.forEach(item => {
            const date = moment(item.startTime).format('YYYY-MM-DD');
            const time = `${moment(item.startTime).format('HH:mm')} - ${moment(item.endTime).format('HH:mm')}`;
            const duration = Math.round(moment.duration(moment(item.endTime).diff(moment(item.startTime))).asMinutes());
            const status = item.isCompleted ? "Completed" : "Pending";
            const note = item.note ? `"${item.note.replace(/"/g, '""')}"` : '';
            csv += `${date},${time},"${item.type}",${duration},${status},${note}\n`;
        });

        const fileUri = FileSystem.documentDirectory + 'daily_log_export.csv';
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });
        await Sharing.shareAsync(fileUri);
    } catch (e) {
        Alert.alert("Export Failed", e.message);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete", `Remove ${selectedIds.size} items?`, [
       { text: "Cancel", style: "cancel" },
       { text: "Delete", style: "destructive", onPress: () => {
           deleteActivities(Array.from(selectedIds));
           setSelectionMode(false); setSelectedIds(new Set()); loadData();
       }}
    ]);
  };

  const handleEdit = () => {
    if (selectedIds.size !== 1) return;
    const idToEdit = Array.from(selectedIds)[0];
    setSelectionMode(false); setSelectedIds(new Set());
    router.push({ pathname: '/add', params: { id: idToEdit } });
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedIds);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    if (newSet.size === 0) setSelectionMode(false);
    setSelectedIds(newSet);
  };

  const toggleCheck = async (id, currentStatus) => {
    if (selectionMode) return;
    toggleActivityCompletion(id, currentStatus);
    loadData();
    if (Platform.OS !== 'web') {
        try { await Haptics.selectionAsync(); } catch (e) {}
    }
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const changeDate = (days) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const togglePicker = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowDatePicker(!showDatePicker); };
  const jumpToToday = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCurrentDate(new Date()); setShowDatePicker(false); };
  const formatHeaderDate = (date) => `W${moment(date).format('WW')} ${moment(date).format('MMM D ddd')}`;

  const renderItem = ({ item }) => {
    const isSelected = selectedIds.has(item.id);
    const isCompleted = item.isCompleted === 1;

    return (
      <TouchableOpacity
        onLongPress={() => { setSelectionMode(true); const s = new Set(); s.add(item.id); setSelectedIds(s); }}
        onPress={() => selectionMode && toggleSelection(item.id)}
        activeOpacity={0.7}
        style={[styles.card, { backgroundColor: theme.card, opacity: isCompleted ? 0.6 : 1 }]}
      >
        {selectionMode ? (
          <View style={[styles.selectIcon, { borderColor: isSelected ? theme.accent : theme.subText, backgroundColor: isSelected ? theme.accent : 'transparent' }]}>
            {isSelected && <View style={styles.selectDot} />} 
          </View>
        ) : (
          <TouchableOpacity onPress={() => toggleCheck(item.id, item.isCompleted)} style={{ paddingRight: 15 }}>
             <View style={[styles.checkCircle, { borderColor: isCompleted ? theme.subText : theme.checkCircle, backgroundColor: isCompleted ? theme.subText : 'transparent' }]}>
                 {isCompleted && <Ionicons name="checkmark" size={12} color={theme.card} />}
             </View>
          </TouchableOpacity>
        )}

        <View style={styles.cardContent}>
          <View style={[styles.timeContainer, { borderRightColor: theme.border }]}>
            <Text style={[styles.timeText, { color: theme.text }]} numberOfLines={1}>
              {moment(item.startTime).format('h:mm A')} - {moment(item.endTime).format('h:mm A')}
            </Text>
          </View>
          <View style={styles.infoContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[styles.typeText, { color: theme.text }]}>{item.type}</Text>
              <Text style={[styles.durationText, { color: theme.subText }]}>
                {(() => {
                  const diff = moment(item.endTime).diff(moment(item.startTime), 'minutes');
                  const h = Math.floor(diff / 60);
                  const m = diff % 60;
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                })()}
              </Text>
            </View>
            {item.note ? <Text style={[styles.noteText, { color: theme.subText }]}>{item.note}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      
      <TouchableWithoutFeedback onPress={cancelSelection}>
        <View style={{ zIndex: 10 }}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <View style={styles.navGroup}>
                    <TouchableOpacity onPress={() => changeDate(-1)} style={[styles.navButton, { backgroundColor: theme.arrowBg }]}>
                        <Ionicons name="chevron-back" size={20} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={togglePicker} style={styles.dateContainer}>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>{formatHeaderDate(currentDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => changeDate(1)} style={[styles.navButton, { backgroundColor: theme.arrowBg }]}>
                        <Ionicons name="chevron-forward" size={20} color={theme.text} />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
                    <Ionicons name="download-outline" size={22} color={theme.subText} />
                </TouchableOpacity>
            </View>

            {showDatePicker && (
            <View style={[styles.pickerPanel, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
                <View style={styles.pickerRow}>
                    <DateWheel currentDate={currentDate} onDateChange={setCurrentDate} isDark={isDark} />
                    <TouchableOpacity style={styles.todayButton} onPress={jumpToToday}>
                        <Text style={{color: theme.accent, fontSize: 10, fontWeight: '800'}}>TODAY</Text>
                    </TouchableOpacity>
                </View>
            </View>
            )}
        </View>
      </TouchableWithoutFeedback>

      <View style={{flex: 1}} onStartShouldSetResponder={() => selectionMode ? true : false} onResponderRelease={cancelSelection}>
        <FlatList
            data={activities}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <View style={{marginTop: 40, paddingHorizontal: 40}}>
                    <Text style={[styles.quoteText, { color: theme.quoteText }]}>“Time is money.”</Text>
                    <Text style={[styles.quoteAuthor, { color: theme.quoteText }]}>– Benjamin Franklin</Text>
                </View>
            </View>
            }
            ListFooterComponent={<Pressable style={{height: 300}} onPress={() => selectionMode && cancelSelection()} />}
        />
      </View>

      <View style={[styles.bottomBar, { backgroundColor: theme.bg }]}> 
        {selectionMode ? (
          <View style={styles.selectionBar}>
             {/* DONE BUTTON MOVED HERE */}
             <TouchableOpacity style={[styles.doneButtonInline, { backgroundColor: theme.doneBtn }]} onPress={cancelSelection}>
                <Text style={{ color: theme.accent, fontWeight: '700' }}>Done</Text>
             </TouchableOpacity>

             <View style={styles.actionRow}>
                {selectedIds.size === 1 && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.arrowBg }]} onPress={handleEdit}>
                    <Text style={{color: theme.text, fontWeight: '600'}}>Edit</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.danger }]} onPress={handleDelete}>
                    <Text style={{color: '#FFF', fontWeight: '600'}}>Delete ({selectedIds.size})</Text>
                </TouchableOpacity>
             </View>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.fab, { backgroundColor: theme.accent }]} 
            onPress={() => router.push({ pathname: '/add', params: { date: currentDate.getTime() } })}
          >
            <Ionicons name="add" size={32} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  navGroup: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  headerTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  navButton: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  exportBtn: { position: 'absolute', right: 20 },
  // REMOVED OLD ABSOLUTE CANCEL BUTTON
  pickerPanel: { borderBottomWidth: 1, paddingBottom: 10 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 },
  wheelContainer: { flexDirection: 'row', justifyContent: 'center', height: ITEM_HEIGHT * 3, width: 230 },
  wheelColumn: { flex: 1, alignItems: 'center' },
  wheelItem: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  wheelHighlight: { position: 'absolute', width: '100%', height: ITEM_HEIGHT, backgroundColor: 'transparent' },
  todayButton: { paddingVertical: 6, paddingHorizontal: 8, marginLeft: 0, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(128,128,128,0.3)' },
  listContent: { padding: 16, paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  quoteText: { fontSize: 18, fontStyle: 'italic', textAlign: 'center', marginBottom: 5, fontWeight: '300' },
  quoteAuthor: { fontSize: 12, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  card: { flexDirection: 'row', padding: 12, borderRadius: 16, marginBottom: 5, alignItems: 'center', elevation: 1 },
  cardContent: { flex: 1, flexDirection: 'row', alignItems: 'center' }, 
  selectIcon: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  selectDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  checkCircle: { width: 20, height: 20, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  timeContainer: { width: 102, borderRightWidth: 1, alignItems: 'flex-end', paddingRight: 8, justifyContent: 'center' },
  timeText: { fontSize: 12, fontWeight: '600' }, 
  infoContainer: { flex: 1, paddingLeft: 8 },
  typeText: { fontSize: 15, fontWeight: '700' },
  durationText: { fontSize: 12, fontWeight: '600' },
  noteText: { fontSize: 14, marginTop: 4 },
  
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, alignItems: 'center', justifyContent: 'center' },
  fab: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 4 },
  
  // NEW STYLES FOR SELECTION MODE
  selectionBar: { alignItems: 'center', width: '100%', paddingBottom: 20 },
  doneButtonInline: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: 15, elevation: 2 },
  actionRow: { flexDirection: 'row', gap: 15 },
  actionBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, elevation: 3 },
});
