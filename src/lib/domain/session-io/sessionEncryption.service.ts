// ================================================================================
// ФАЙЛ: src/lib/domain/session-io/sessionEncryption.service.ts
// Описание: Сервис для шифрования и расшифровки экспортных файлов чата (Web Crypto API)
// ================================================================================

export type EncryptionScheme = 'auto' | 'password';

export interface EncryptedExportAuto {
  scheme: 'auto';
  algorithm: 'AES-GCM';
  iv: string; // Base64
  embeddedKey: string; // Base64
}

export interface EncryptedExportPassword {
  scheme: 'password';
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2';
  iterations: number;
  hash: 'SHA-256';
  salt: string; // Base64
  iv: string; // Base64
}

export interface EncryptedExportContainer {
  type: 'encrypted_chat_export';
  version: '3.0';
  mode: 'roleplay' | 'hero' | 'team';
  exportedAt: string;
  encryption: EncryptedExportAuto | EncryptedExportPassword;
  data: string; // Base64 ciphertext
}

// ================================================================================
// УТИЛИТЫ: КОНВЕРТАЦИЯ BASE64 <-> ARRAYBUFFER
// ================================================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  // Используем цикл, чтобы избежать ошибки Maximum Call Stack Size при больших файлах
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

// ================================================================================
// ОСНОВНОЙ СЕРВИС ШИФРОВАНИЯ
// ================================================================================

export class SessionEncryptionService {
  private readonly ITERATIONS = 250000; // Рекомендуемое значение для PBKDF2
  private readonly HASH_ALGO = 'SHA-256';

  /**
   * Проверяет, является ли объект зашифрованным контейнером
   */
  isEncryptedContainer(obj: any): obj is EncryptedExportContainer {
    return obj && typeof obj === 'object' && obj.type === 'encrypted_chat_export';
  }

  // ==============================================================================
  // РЕЖИМ: АВТОМАТИЧЕСКОЕ ШИФРОВАНИЕ (БЕЗ ПАРОЛЯ)
  // ==============================================================================

  /**
   * Шифрует payload случайным ключом и вшивает ключ внутрь контейнера
   */
  async encryptAuto(payload: any): Promise<EncryptedExportContainer> {
    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(payload));

    // Генерируем случайный AES ключ
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // Экспортируем ключ для сохранения в файл
    const exportedKeyBuffer = await window.crypto.subtle.exportKey('raw', key);
    const embeddedKeyB64 = arrayBufferToBase64(exportedKeyBuffer);

    // Шифруем данные
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    return {
      type: 'encrypted_chat_export',
      version: '3.0',
      mode: payload.mode || 'roleplay',
      exportedAt: new Date().toISOString(),
      encryption: {
        scheme: 'auto',
        algorithm: 'AES-GCM',
        iv: arrayBufferToBase64(iv),
        embeddedKey: embeddedKeyB64
      },
      data: arrayBufferToBase64(ciphertextBuffer)
    };
  }

  /**
   * Расшифровывает контейнер, используя вшитый ключ
   */
  async decryptAuto(container: EncryptedExportContainer): Promise<any> {
    if (container.encryption.scheme !== 'auto') {
      throw new Error('Неверная схема шифрования. Ожидалась "auto".');
    }

    const encData = container.encryption as EncryptedExportAuto;
    const keyBuffer = base64ToArrayBuffer(encData.embeddedKey);
    const ivBuffer = base64ToArrayBuffer(encData.iv);
    const ciphertextBuffer = base64ToArrayBuffer(container.data);

    // Импортируем ключ обратно
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      'AES-GCM',
      false,
      ['decrypt']
    );

    try {
      // Расшифровываем
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer },
        key,
        ciphertextBuffer
      );

      const dec = new TextDecoder();
      const jsonStr = dec.decode(decryptedBuffer);
      return JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('Ошибка расшифровки файла. Файл повреждён.');
    }
  }

  // ==============================================================================
  // РЕЖИМ: ШИФРОВАНИЕ С ПАРОЛЕМ ПОЛЬЗОВАТЕЛЯ
  // ==============================================================================

  /**
   * Создает AES ключ из текстового пароля пользователя
   */
  private async deriveKeyFromPassword(password: string, saltBuffer: ArrayBuffer, iterations: number): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: iterations,
        hash: this.HASH_ALGO
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Шифрует payload ключом, созданным из пароля пользователя
   */
  async encryptWithPassword(payload: any, password: string): Promise<EncryptedExportContainer> {
    if (!password) throw new Error('Пароль не может быть пустым');

    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(payload));

    // Генерируем соль и получаем ключ
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await this.deriveKeyFromPassword(password, salt, this.ITERATIONS);

    // Шифруем данные
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    return {
      type: 'encrypted_chat_export',
      version: '3.0',
      mode: payload.mode || 'roleplay',
      exportedAt: new Date().toISOString(),
      encryption: {
        scheme: 'password',
        algorithm: 'AES-GCM',
        kdf: 'PBKDF2',
        iterations: this.ITERATIONS,
        hash: this.HASH_ALGO,
        salt: arrayBufferToBase64(salt),
        iv: arrayBufferToBase64(iv)
      },
      data: arrayBufferToBase64(ciphertextBuffer)
    };
  }

  /**
   * Расшифровывает контейнер, используя введенный пользователем пароль
   */
  async decryptWithPassword(container: EncryptedExportContainer, password: string): Promise<any> {
    if (container.encryption.scheme !== 'password') {
      throw new Error('Неверная схема шифрования. Ожидалась "password".');
    }

    const encData = container.encryption as EncryptedExportPassword;
    const saltBuffer = base64ToArrayBuffer(encData.salt);
    const ivBuffer = base64ToArrayBuffer(encData.iv);
    const ciphertextBuffer = base64ToArrayBuffer(container.data);

    // Восстанавливаем ключ по паролю и сохраненной соли
    const key = await this.deriveKeyFromPassword(password, saltBuffer, encData.iterations);

    try {
      // Расшифровываем
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer },
        key,
        ciphertextBuffer
      );

      const dec = new TextDecoder();
      const jsonStr = dec.decode(decryptedBuffer);
      return JSON.parse(jsonStr);
    } catch (e) {
      // DOMException "OperationError" означает, что ключ (пароль) не подошел
      throw new Error('Неверный пароль или файл повреждён.');
    }
  }
}

export const sessionEncryptionService = new SessionEncryptionService();