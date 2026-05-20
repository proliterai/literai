// ================================================================================
// ФАЙЛ: src/lib/utils/steganography.ts
// Описание: Встраивание и извлечение JSON-данных из файлов изображений
// ================================================================================

// Секретный маркер, по которому мы будем искать начало наших данных в файле
const MARKER = new TextEncoder().encode("===LITERAI_SESSION_DATA===");

/**
 * Вшивает JSON объект в конец файла изображения
 */
export async function encodeDataToImage(imageFile: File, jsonData: any): Promise<Blob> {
    const imageBuffer = await imageFile.arrayBuffer();
    const jsonString = JSON.stringify(jsonData);
    const dataBuffer = new TextEncoder().encode(jsonString);

    // Создаем новый буфер: Оригинальная картинка + МАРКЕР + JSON Данные
    const combined = new Uint8Array(imageBuffer.byteLength + MARKER.byteLength + dataBuffer.byteLength);
    
    combined.set(new Uint8Array(imageBuffer), 0);
    combined.set(MARKER, imageBuffer.byteLength);
    combined.set(dataBuffer, imageBuffer.byteLength + MARKER.byteLength);

    // Возвращаем как Blob с оригинальным MIME-типом
    return new Blob([combined], { type: imageFile.type });
}

/**
 * Ищет и извлекает JSON из файла изображения
 */
export async function decodeDataFromImage(imageFile: File): Promise<any | null> {
    const buffer = await imageFile.arrayBuffer();
    const view = new Uint8Array(buffer);

    // Ищем маркер с конца файла (так как данные добавлены в конец)
    let markerIndex = -1;
    for (let i = view.length - MARKER.length; i >= 0; i--) {
        let match = true;
        for (let j = 0; j < MARKER.length; j++) {
            if (view[i + j] !== MARKER[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            markerIndex = i;
            break;
        }
    }

    if (markerIndex === -1) {
        return null; // Маркер не найден, это обычная картинка
    }

    // Извлекаем данные после маркера
    const dataBuffer = view.slice(markerIndex + MARKER.length);
    const jsonString = new TextDecoder().decode(dataBuffer);

    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("[Steganography] Ошибка парсинга извлеченного JSON:", e);
        return null;
    }
}