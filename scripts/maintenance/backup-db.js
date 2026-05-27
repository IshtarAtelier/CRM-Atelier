/**
 * ⚠️ DEPRECATED: Este script es OBSOLETO.
 * El proyecto ahora usa PostgreSQL en producción.
 * Para realizar un backup, utiliza el endpoint de la API:
 *   GET /api/backup 
 * 
 * O usa el módulo src/lib/backup.ts para crear un snapshot completo.
 * 
 * Script de backup automático local (Solo para entornos legacy SQLite)
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'prisma', 'dev.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = 10; // Mantener solo los últimos 10 backups

function formatDate() {
  const now = new Date();
  return now.toISOString()
    .replace(/[T]/g, '_')
    .replace(/[:.]/g, '-')
    .slice(0, 19);
}

function cleanOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('dev_') && f.endsWith('.db'))
    .sort()
    .reverse();
  
  // Eliminar backups viejos (mantener solo MAX_BACKUPS)
  if (files.length >= MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS - 1);
    toDelete.forEach(file => {
      const filePath = path.join(BACKUP_DIR, file);
      fs.unlinkSync(filePath);
      console.log(`  🗑️  Eliminado backup viejo: ${file}`);
    });
  }
}

function backup() {
  console.log('\n📦 Backup de Base de Datos');
  console.log('─'.repeat(40));

  // Verificar que existe la DB
  if (!fs.existsSync(DB_PATH)) {
    console.warn('⚠️ No se encontró la base de datos SQLite en:', DB_PATH);
    console.warn('   Saltando backup (Probablemente usando Postgres u otra DB)');
    return null;
  }

  // Crear directorio de backups si no existe
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Limpiar backups viejos
  cleanOldBackups();

  // Crear backup
  const timestamp = formatDate();
  const backupName = `dev_${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  fs.copyFileSync(DB_PATH, backupPath);
  
  const sizeKB = (fs.statSync(backupPath).size / 1024).toFixed(1);
  
  console.log(`  ✅ Backup creado: ${backupName} (${sizeKB} KB)`);
  console.log(`  📁 Ubicación: ${backupPath}`);
  console.log('─'.repeat(40) + '\n');

  return backupPath;
}

// Ejecutar si se llama directamente
if (require.main === module) {
  backup();
}

module.exports = { backup };
