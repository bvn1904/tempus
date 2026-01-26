import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, useColorScheme, FlatList, Keyboard, TouchableWithoutFeedback, Alert, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import moment from 'moment';
import * as Haptics from 'expo-haptics';
import { addActivity, getLastActivity, getActivityById, updateActivity, getMostFrequentActivities } from '../src/db/database';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ITEM_HEIGHT = 40; 
const LOOPS = 300; 

const TimeWheel = ({ value, onChange, isDark }) => {
  const hours = Array.from({ length: 12 }, (_, i) => i + 1); 
  const minutes = Array.from({ length: 60 }, (_, i) => i);   
  const periods = ['AM', 'PM'];

  const [editMode, setEditMode] = useState(null); 
  const [tempInput, setTempInput] = useState('');

  const activeColor = '#007AFF';
  const passiveColor = isDark ? '#636366' : '#AEAEB2'; 
  const textColor = isDark ? '#FFFFFF' : '#000000';

  const get12Hour = (date) => {
    let h = date.getHours();
    if (h === 0) return 12;
    if (h > 12) return h - 12;
    return h;
  };
  const getPeriod = (date) => (date.getHours() >= 12 ? 'PM' : 'AM');

  const updateTime = (type, newVal) => {
    const newDate = new Date(value);
    let h = newDate.getHours();
    let isPm = h >= 12;
    if (type === 'hour') {
      if (isPm) { h = newVal === 12 ? 12 : newVal + 12; } else { h = newVal === 12 ? 0 : newVal; }
      newDate.setHours(h);
    } else if (type === 'minute') {
      newDate.setMinutes(newVal);
    } else if (type === 'period') {
      if (newVal === 'AM' && isPm) newDate.setHours(h - 12);
      else if (newVal === 'PM' && !isPm) newDate.setHours(h + 12);
    }
    onChange(newDate);
  };

  const startEditing = (type, currentVal) => {
    setEditMode(type);
    setTempInput(currentVal.toString());
  };

  const finishEditing = () => {
    if (!editMode) return;
    let num = parseInt(tempInput, 10);
    if (isNaN(num)) num = 0;

    if (editMode === 'hour') {
      num = Math.min(12, Math.max(1, num));
      updateTime('hour', num);
    } else if (editMode === 'minute') {
      num = Math.min(59, Math.max(0, num));
      updateTime('minute', num);
    }
    setEditMode(null);
    Keyboard.dismiss();
  };

  const RenderWheel = ({ data, selected, type, infinite = false }) => {
    if (editMode === type) {
      return (
        <View style={[styles.column, { justifyContent: 'center' }]}>
          <TextInput
            style={[styles.editInput, { color: activeColor, borderColor: activeColor }]}
            value={tempInput}
            onChangeText={setTempInput}
            onBlur={finishEditing}
            onSubmitEditing={finishEditing}
            keyboardType="number-pad"
            autoFocus={true}
            maxLength={2}
          />
        </View>
      );
    }

    const flatListRef = useRef(null);
    const renderData = useMemo(() => infinite ? Array.from({ length: LOOPS }, () => data).flat() : ['', ...data, ''], [data, infinite]);
    
    const initialIndex = useMemo(() => infinite 
      ? (Math.floor(LOOPS / 2) * data.length) + data.indexOf(selected) - 1 
      : data.indexOf(selected), 
    []);

    const settleWheel = (e) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const roundedIndex = Math.round(offsetY / ITEM_HEIGHT) + 1;
      
      if (renderData[roundedIndex] !== undefined && renderData[roundedIndex] !== selected) {
          if (renderData[roundedIndex] !== '') updateTime(type, renderData[roundedIndex]);
      }
      if (infinite && flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: (roundedIndex - 1) * ITEM_HEIGHT, animated: true });
      }
    };

    return (
      <View style={styles.column}>
        <View style={[styles.wheelHighlight, { top: ITEM_HEIGHT }]} />
        <FlatList
          ref={flatListRef}
          data={renderData}
          keyExtractor={(_, i) => type + i}
          showsVerticalScrollIndicator={false}
          snapToInterval={infinite ? undefined : ITEM_HEIGHT} 
          decelerationRate={infinite ? 0.97 : 'fast'}
          getItemLayout={(d, i) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * i, index: i })}
          initialScrollIndex={initialIndex}
          onMomentumScrollEnd={settleWheel}
          onScrollEndDrag={(e) => { if (infinite && e.nativeEvent.velocity && e.nativeEvent.velocity.y === 0) settleWheel(e); }}
          windowSize={5} initialNumToRender={15} maxToRenderPerBatch={10}
          renderItem={({ item }) => {
            if (item === '') return <View style={{ height: ITEM_HEIGHT }} />;
            const isSelected = item === selected;
            return (
              <TouchableOpacity 
                style={[styles.itemContainer, { opacity: isSelected ? 1 : 0.5, transform: [{ scale: isSelected ? 1.05 : 0.95 }] }]} 
                activeOpacity={1} 
                onPress={() => isSelected ? startEditing(type, item) : updateTime(type, item)}
              >
                <Text style={{ fontSize: isSelected ? 20 : 16, fontWeight: isSelected ? '700' : '500', color: isSelected ? textColor : passiveColor }}>
                  {typeof item === 'number' ? item.toString().padStart(2, '0') : item}
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
      <RenderWheel data={hours} selected={get12Hour(value)} type="hour" infinite />
      <Text style={[styles.wheelSeparator, { color: textColor }]}>:</Text>
      <RenderWheel data={minutes} selected={value.getMinutes()} type="minute" infinite />
      <View style={{ width: 10 }} /> 
      <RenderWheel data={periods} selected={getPeriod(value)} type="period" infinite={false} />
    </View>
  );
};

export default function AddScreen() {
  const router = useRouter();
  const { id, date } = useLocalSearchParams(); 
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [type, setType] = useState('');
  const [note, setNote] = useState('');
  const [tokens, setTokens] = useState(['Study', 'Gym', 'Sleep']);

  const [selectedDayOffset, setSelectedDayOffset] = useState(0); 
  const [baseDate, setBaseDate] = useState(new Date()); 

  const [startTime, setStartTime] = useState(new Date()); 
  const [endTime, setEndTime] = useState(new Date());
  
  const [activePicker, setActivePicker] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const init = async () => {
        try {
            const frequent = await getMostFrequentActivities();
            if (frequent && frequent.length > 0) {
                const defaults = ['Study', 'Gym', 'Sleep'];
                setTokens([...new Set([...frequent, ...defaults])].slice(0, 3));
            }
        } catch(e) {}

        const refDate = date ? new Date(parseInt(date)) : new Date();
        setBaseDate(refDate);

        if (id) {
            const existing = await getActivityById(id);
            if (existing) {
                setType(existing.type);
                setNote(existing.note);
                setStartTime(new Date(existing.startTime));
                setEndTime(new Date(existing.endTime));
            }
        } else {
            const lastActivity = getLastActivity();
            if (lastActivity && moment(lastActivity.endTime).isSame(refDate, 'day')) {
                setStartTime(new Date(lastActivity.endTime));
                const end = new Date(lastActivity.endTime);
                end.setHours(end.getHours() + 1);
                setEndTime(end);
            } else {
                const start = new Date(refDate);
                start.setHours(9, 0, 0, 0); 
                setStartTime(start);
                const end = new Date(start);
                end.setHours(10, 0, 0, 0);
                setEndTime(end);
            }
        }
    };
    init();
  }, [id, date]);

  const handleDayChange = (offset) => {
    setSelectedDayOffset(offset);
    const newTarget = new Date(baseDate);
    newTarget.setDate(newTarget.getDate() + offset);
    const shiftDate = (oldDate, target) => {
        const d = new Date(target);
        d.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0);
        return d;
    };
    setStartTime(shiftDate(startTime, newTarget));
    setEndTime(shiftDate(endTime, newTarget));
  };

  const theme = {
    bg: isDark ? '#000000' : '#F2F2F7',
    text: isDark ? '#FFFFFF' : '#000000',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    subText: '#8E8E93',
    errorBg: '#FF453A',
    quoteText: isDark ? '#555' : '#AAA',
    chipBorder: isDark ? '#38383A' : '#C7C7CC',
    accent: '#007AFF',
    selectedDayBg: '#007AFF',
    unselectedDayBg: isDark ? '#1C1C1E' : '#FFFFFF',
  };

  const handleSave = async () => {
    setErrorMsg(null);
    if (!type.trim()) { setErrorMsg('Please enter an activity type !'); return; }
    if (endTime < startTime) { setErrorMsg('End time cannot be before Start time !'); return; }

    const now = new Date();
    const isCompleted = endTime < now ? 1 : 0;

    if (!moment(startTime).isSame(moment(endTime), 'day')) {
        Alert.alert("Extends to next day", "Split or Edit?", [
            { text: "Cancel", style: "cancel" },
            { text: "Split", onPress: async () => {
                const midnight = new Date(startTime); midnight.setHours(23, 59, 59, 999);
                const nextDayStart = new Date(endTime); nextDayStart.setHours(0, 0, 0, 0);
                
                const isPart1Done = midnight < now ? 1 : 0;
                const isPart2Done = endTime < now ? 1 : 0;

                if (id) { 
                    updateActivity(id, type, note, startTime.getTime(), midnight.getTime(), isPart1Done); 
                    addActivity(type, note, nextDayStart.getTime(), endTime.getTime(), isPart2Done); 
                } else { 
                    addActivity(type, note, startTime.getTime(), midnight.getTime(), isPart1Done); 
                    addActivity(type, note, nextDayStart.getTime(), endTime.getTime(), isPart2Done); 
                }
                router.back();
            }},
            { text: "Edit", style: "default" }
        ]);
        return;
    }
    
    try { 
        if (id) updateActivity(id, type, note, startTime.getTime(), endTime.getTime(), isCompleted);
        else addActivity(type, note, startTime.getTime(), endTime.getTime(), isCompleted); 
        router.back(); 
    } catch (e) { console.error(e); }
  };

  const formatTime = (date) => moment(date).format('h:mm A');
  const toggleStart = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActivePicker(activePicker === 'start' ? null : 'start'); Keyboard.dismiss(); };
  const toggleEnd = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActivePicker(activePicker === 'end' ? null : 'end'); Keyboard.dismiss(); };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}><View style={{flex: 1, flexDirection: 'column'}}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{id ? 'Edit' : 'New Log'}</Text>
                <TouchableOpacity onPress={handleSave} style={styles.saveBtn}><Text style={styles.saveLink}>Save</Text></TouchableOpacity>
            </View>

            {errorMsg && <View style={styles.errorBanner}><Text style={styles.errorText}>{errorMsg}</Text></View>}

            <View style={{flex: 1, paddingHorizontal: 20, paddingTop: 10}}>
                
                {/* 5-DAY PICKER with Dates */}
                <View style={styles.dayPickerContainer}>
                    {[0, 1, 2, 3, 4].map((offset) => {
                        const d = new Date(baseDate);
                        d.setDate(d.getDate() + offset);
                        const isSelected = selectedDayOffset === offset;
                        const label = offset === 0 ? 'Today' : offset === 1 ? 'Tom' : moment(d).format('ddd');
                        const dayNum = moment(d).format('D');
                        
                        return (
                            <TouchableOpacity 
                                key={offset}
                                style={[
                                    styles.dayBtn, 
                                    { backgroundColor: isSelected ? theme.selectedDayBg : theme.unselectedDayBg, borderColor: theme.chipBorder }
                                ]}
                                onPress={() => handleDayChange(offset)}
                            >
                                <Text style={{ color: isSelected ? '#FFF' : theme.subText, fontSize: 11, fontWeight: '600' }}>{label}</Text>
                                {/* NEW: Date Number */}
                                <Text style={{ color: isSelected ? '#FFF' : theme.subText, fontSize: 12, fontWeight: '800', marginTop: 2 }}>{dayNum}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={{marginBottom: 40}}>
                    <TouchableOpacity style={[styles.timeCard, { backgroundColor: theme.card }]} onPress={toggleStart}>
                        <View style={styles.row}>
                            <Text style={[styles.label, { color: theme.subText }]}>Start Time</Text>
                            <Text style={[styles.timeDisplay, { color: theme.text }]}>{formatTime(startTime)}</Text>
                        </View>
                        {activePicker === 'start' && <View style={styles.pickerWrapper}><TimeWheel value={startTime} onChange={setStartTime} isDark={isDark} /></View>}
                    </TouchableOpacity>
                    
                    <View style={{height: 15}}/>

                    <TouchableOpacity style={[styles.timeCard, { backgroundColor: theme.card }]} onPress={toggleEnd}>
                        <View style={styles.row}>
                            <Text style={[styles.label, { color: theme.subText }]}>End Time</Text>
                            <Text style={[styles.timeDisplay, { color: theme.text }]}>{formatTime(endTime)}</Text>
                        </View>
                        {activePicker === 'end' && <View style={styles.pickerWrapper}><TimeWheel value={endTime} onChange={setEndTime} isDark={isDark} /></View>}
                    </TouchableOpacity>
                </View>

                <View style={{gap: 15}}> 
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Text style={[styles.inputLabel, { color: theme.subText }]}>DETAILS</Text>
                        <View style={{flexDirection: 'row', gap: 8}}>
                            {tokens.map(token => (
                                <TouchableOpacity 
                                    key={token} 
                                    style={[styles.chip, { borderColor: theme.chipBorder }]}
                                    onPress={() => setType(token)}
                                >
                                    <Text style={{color: theme.subText, fontSize: 13, fontWeight: '600'}}>{token}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} placeholder="Activity" placeholderTextColor={theme.subText} value={type} onChangeText={setType} />
                    <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} placeholder="Notes..." placeholderTextColor={theme.subText} value={note} onChangeText={setNote} />
                </View>

                <View style={{flex: 1, justifyContent: 'center', opacity: 0.6}}>
                    <Text style={[styles.quoteText, { color: theme.quoteText }]}>“Time is money.”</Text>
                    <Text style={[styles.quoteAuthor, { color: theme.quoteText }]}>– Benjamin Franklin</Text>
                </View>
            </View>
        </View></TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 10 },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  saveBtn: { marginRight: 5 }, 
  saveLink: { fontSize: 18, color: '#007AFF', fontWeight: '600' },
  errorBanner: { backgroundColor: '#FF453A', padding: 8, marginHorizontal: 20, borderRadius: 8, marginBottom: 10 },
  errorText: { color: '#FFF', fontWeight: '600', textAlign: 'center', fontSize: 12 },
  
  dayPickerContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  dayBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, marginHorizontal: 3, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },

  timeCard: { padding: 15, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
  timeDisplay: { fontSize: 18, fontWeight: '700' },
  pickerWrapper: { marginTop: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(128,128,128, 0.1)', paddingTop: 10 },
  wheelContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 220 },
  column: { height: ITEM_HEIGHT * 3, width: 60, alignItems: 'center' },
  wheelSeparator: { fontSize: 24, fontWeight: '700', marginHorizontal: 5, paddingBottom: 5 },
  wheelHighlight: { position: 'absolute', width: '100%', height: ITEM_HEIGHT, backgroundColor: 'transparent' },
  itemContainer: { height: ITEM_HEIGHT, width: 60, justifyContent: 'center', alignItems: 'center' },
  editInput: { fontSize: 24, fontWeight: '700', borderBottomWidth: 2, textAlign: 'center', width: 50 },
  hintText: { marginTop: 10, fontSize: 12, color: '#8E8E93' },
  inputLabel: { fontSize: 12, fontWeight: '600', paddingLeft: 5 },
  input: { fontSize: 16, padding: 14, borderRadius: 12 },
  quoteText: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginBottom: 5, fontWeight: '300' },
  quoteAuthor: { fontSize: 10, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
});
