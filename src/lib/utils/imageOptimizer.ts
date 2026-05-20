// src/lib/utils/imageOptimizer.ts

/**
 * Умная оптимизация изображений перед сохранением.
 * @param file Исходный файл изображения
 * @param maxMbSize Порог в мегабайтах, после которого включается сжатие (по умолчанию 1 МБ)
 * @param maxDimension Максимальный размер по большей стороне (по умолчанию 1200px - HD качество)
 */
export async function optimizeImage(file: File, maxMbSize = 1, maxDimension = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result as string;

      // Если файл весит меньше порога (например, 1 МБ) ИЛИ это GIF (Canvas сломает анимацию)
      // Мы просто возвращаем оригинальный Base64
      if (file.size < maxMbSize * 1024 * 1024 || file.type === 'image/gif') {
        resolve(result);
        return;
      }

      // Иначе — пропускаем через Canvas для HD-оптимизации
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Высчитываем новые размеры, сохраняя пропорции
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result); // Fallback: если canvas не сработал, отдаем оригинал
          return;
        }

        // Рисуем картинку с новыми размерами
        ctx.drawImage(img, 0, 0, width, height);

        // Экспортируем в современный формат WebP с высоким качеством 90%
        // (Визуально разницы с оригиналом не будет, но вес упадет колоссально)
        const optimizedBase64 = canvas.toDataURL('image/webp', 0.90);
        resolve(optimizedBase64);
      };

      img.onerror = () => reject(new Error('Ошибка чтения изображения'));
      img.src = result;
    };

    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
}