/**
 * GENESIS - Backup Service
 * Sistema de respaldo y restauración con encriptación
 */

import { db } from './dataService';

// ==================== ENCRIPTACIÓN SIMPLE ====================
// En producción usar Web Crypto API con AES-GCM

class BackupService {
  constructor() {
    this.encryptionKey = null;
  }

  // Generar clave de encriptación desde contraseña
  async deriveKey(password) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('RauliERP-Salt-2024'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Encriptar datos
  async encrypt(data, password) {
    try {
      const key = await this.deriveKey(password);
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(JSON.stringify(data))
      );

      // Combinar IV + datos encriptados
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      return this.arrayBufferToBase64(combined);
    } catch (err) {
      console.error('Error encrypting:', err);
      throw new Error('Error al encriptar datos');
    }
  }

  // Desencriptar datos
  async decrypt(encryptedBase64, password) {
    try {
      const key = await this.deriveKey(password);
      const combined = this.base64ToArrayBuffer(encryptedBase64);
      
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(decrypted));
    } catch (err) {
      console.error('Error decrypting:', err);
      throw new Error('Error al desencriptar datos. Verifica la contraseña.');
    }
  }

  // Utilidades de conversión
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // ==================== EXPORTAR BACKUP ====================

  async exportBackup(options = {}) {
    const {
      encrypt = false,
      password = null,
      includeSettings = true,
      includeSales = true,
      includeProducts = true,
      includeInventory = true,
      includeEmployees = true,
      includeAccounting = true
    } = options;

    try {
      const backup = {
        version: '1.0.0',
        app: 'GENESIS',
        created_at: new Date().toISOString(),
        encrypted: encrypt,
        data: {}
      };

      // Exportar tablas seleccionadas
      if (includeProducts) {
        backup.data.products = await db.products.toArray();
        backup.data.categories = await db.categories.toArray();
      }

      if (includeSales) {
        backup.data.sales = await db.sales.toArray();
        backup.data.saleItems = await db.saleItems.toArray();
        backup.data.cashSessions = await db.cashSessions.toArray();
      }

      if (includeInventory) {
        backup.data.inventoryMovements = await db.inventoryMovements.toArray();
      }

      if (includeEmployees) {
        backup.data.employees = await db.employees.toArray();
      }

      if (includeSettings) {
        backup.data.settings = await db.settings.toArray();
      }

      // Estadísticas del backup
      backup.stats = {
        products: backup.data.products?.length || 0,
        sales: backup.data.sales?.length || 0,
        employees: backup.data.employees?.length || 0,
        totalRecords: Object.values(backup.data).reduce((sum, arr) => sum + (arr?.length || 0), 0)
      };

      let exportData;
      let filename;

      if (encrypt && password) {
        const encryptedData = await this.encrypt(backup.data, password);
        exportData = JSON.stringify({
          ...backup,
          data: encryptedData,
          encrypted: true
        }, null, 2);
        filename = `rauli-backup-encrypted-${this.formatDate(new Date())}.json`;
      } else {
        exportData = JSON.stringify(backup, null, 2);
        filename = `rauli-backup-${this.formatDate(new Date())}.json`;
      }

      // Crear y descargar archivo
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Guardar timestamp del último backup
      localStorage.setItem('last_backup_timestamp', new Date().toISOString());

      return {
        success: true,
        filename,
        stats: backup.stats
      };
    } catch (err) {
      console.error('Error creating backup:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  // ==================== IMPORTAR BACKUP ====================

  async importBackup(file, options = {}) {
    const {
      password = null,
      overwrite = false,
      merge = true
    } = options;

    try {
      const text = await this.readFile(file);
      const backup = JSON.parse(text);

      // Validar formato
      if (!backup.version || !backup.app || !['GENESIS', 'GENESIS'].includes(backup.app)) {
        throw new Error('Formato de backup inválido');
      }

      let data = backup.data;

      // Desencriptar si es necesario
      if (backup.encrypted) {
        if (!password) {
          throw new Error('Se requiere contraseña para este backup encriptado');
        }
        data = await this.decrypt(backup.data, password);
      }

      // Limpiar datos existentes si se especifica
      if (overwrite) {
        await this.clearAllData();
      }

      // Importar datos
      const imported = {
        products: 0,
        sales: 0,
        employees: 0,
        settings: 0
      };

      if (data.categories?.length) {
        await db.categories.bulkPut(data.categories);
      }

      if (data.products?.length) {
        if (merge) {
          await db.products.bulkPut(data.products);
        } else {
          await db.products.bulkAdd(data.products);
        }
        imported.products = data.products.length;
      }

      if (data.sales?.length) {
        await db.sales.bulkPut(data.sales);
        imported.sales = data.sales.length;
      }

      if (data.saleItems?.length) {
        await db.saleItems.bulkPut(data.saleItems);
      }

      if (data.cashSessions?.length) {
        await db.cashSessions.bulkPut(data.cashSessions);
      }

      if (data.inventoryMovements?.length) {
        await db.inventoryMovements.bulkPut(data.inventoryMovements);
      }

      if (data.employees?.length) {
        await db.employees.bulkPut(data.employees);
        imported.employees = data.employees.length;
      }

      if (data.settings?.length) {
        await db.settings.bulkPut(data.settings);
        imported.settings = data.settings.length;
      }

      return {
        success: true,
        imported,
        backupDate: backup.created_at
      };
    } catch (err) {
      console.error('Error importing backup:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  // ==================== AUTO-BACKUP ====================

  async scheduleAutoBackup(intervalHours = 24) {
    const lastBackup = localStorage.getItem('last_backup_timestamp');
    
    if (lastBackup) {
      const hoursSince = (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60);
      if (hoursSince < intervalHours) {
        console.log(`Auto-backup: Último backup hace ${hoursSince.toFixed(1)} horas`);
        return;
      }
    }

    // Crear backup automático en localStorage (sin descargar archivo)
    const backup = await this.createLocalBackup();
    localStorage.setItem('auto_backup', JSON.stringify(backup));
    localStorage.setItem('auto_backup_timestamp', new Date().toISOString());
    
    console.log('Auto-backup creado en localStorage');
  }

  async createLocalBackup() {
    return {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      products: await db.products.toArray(),
      sales: await db.sales.limit(100).toArray(), // Últimas 100 ventas
      settings: await db.settings.toArray()
    };
  }

  async restoreFromLocalBackup() {
    const backup = localStorage.getItem('auto_backup');
    if (!backup) {
      throw new Error('No hay backup local disponible');
    }

    const data = JSON.parse(backup);
    
    if (data.products?.length) {
      await db.products.bulkPut(data.products);
    }
    if (data.settings?.length) {
      await db.settings.bulkPut(data.settings);
    }

    return {
      success: true,
      restored: {
        products: data.products?.length || 0,
        settings: data.settings?.length || 0
      },
      backupDate: data.created_at
    };
  }

  // ==================== UTILIDADES ====================

  async clearAllData() {
    const tables = ['products', 'categories', 'sales', 'saleItems', 'cashSessions', 
                    'inventoryMovements', 'employees', 'settings'];
    
    for (const table of tables) {
      if (db[table]) {
        await db[table].clear();
      }
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  formatDate(date) {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  // Verificar integridad del backup
  async verifyBackup(file) {
    try {
      const text = await this.readFile(file);
      const backup = JSON.parse(text);

      return {
        valid: true,
        version: backup.version,
        app: backup.app,
        created_at: backup.created_at,
        encrypted: backup.encrypted,
        stats: backup.stats
      };
    } catch (err) {
      return {
        valid: false,
        error: err.message
      };
    }
  }
}

// Singleton
const backupService = new BackupService();
export default backupService;
