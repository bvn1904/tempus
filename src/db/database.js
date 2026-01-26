import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('dailytracker.db');

export const initDatabase = () => {
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        note TEXT,
        startTime INTEGER NOT NULL,
        endTime INTEGER NOT NULL,
        isCompleted INTEGER DEFAULT 0
      );
    `);

    // MIGRATION: specific for existing users to add isCompleted column
    try {
      db.execSync('ALTER TABLE activities ADD COLUMN isCompleted INTEGER DEFAULT 0;');
    } catch (e) {
      // Column likely exists, ignore error
    }
  } catch (e) {
    console.error("DB Init Error:", e);
  }
};

export const addActivity = (type, note, startTime, endTime, isCompleted = 0) => {
  db.runSync(
    'INSERT INTO activities (type, note, startTime, endTime, isCompleted) VALUES (?, ?, ?, ?, ?)',
    [type, note, startTime, endTime, isCompleted]
  );
};

export const updateActivity = (id, type, note, startTime, endTime, isCompleted) => {
  db.runSync(
    'UPDATE activities SET type = ?, note = ?, startTime = ?, endTime = ?, isCompleted = ? WHERE id = ?',
    [type, note, startTime, endTime, isCompleted, id]
  );
};

export const toggleActivityCompletion = (id, currentStatus) => {
  const newStatus = currentStatus === 1 ? 0 : 1;
  db.runSync('UPDATE activities SET isCompleted = ? WHERE id = ?', [newStatus, id]);
  return newStatus;
};

export const getActivityById = (id) => {
  const result = db.getAllSync('SELECT * FROM activities WHERE id = ?', [id]);
  return result.length > 0 ? result[0] : null;
};

export const getActivitiesByDate = (timestamp) => {
  const start = new Date(timestamp);
  start.setHours(0, 0, 0, 0);
  const end = new Date(timestamp);
  end.setHours(23, 59, 59, 999);

  return db.getAllSync(
    'SELECT * FROM activities WHERE startTime >= ? AND startTime <= ? ORDER BY startTime DESC',
    [start.getTime(), end.getTime()]
  );
};

export const deleteActivities = (ids) => {
  if (!ids || ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.runSync(`DELETE FROM activities WHERE id IN (${placeholders})`, ids);
};

export const getLastActivity = () => {
  const result = db.getAllSync('SELECT * FROM activities ORDER BY endTime DESC LIMIT 1');
  return result.length > 0 ? result[0] : null;
};

export const getMostFrequentActivities = () => {
  const result = db.getAllSync(
    'SELECT type, COUNT(*) as count FROM activities GROUP BY type ORDER BY count DESC LIMIT 3'
  );
  return result.map(r => r.type);
};

export const getAllActivities = () => {
  return db.getAllSync('SELECT * FROM activities ORDER BY startTime DESC');
};
