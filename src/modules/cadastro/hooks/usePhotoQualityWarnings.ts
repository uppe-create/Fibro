import { useEffect, useState } from 'react';
import { HEAVY_FILE_WARNING_BYTES } from '@/modules/cadastro/components/FileUploadField';

export function usePhotoQualityWarnings(file?: File) {
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!file) {
      setWarnings([]);
      return;
    }

    const nextWarnings: string[] = [];
    if (file.size >= HEAVY_FILE_WARNING_BYTES) {
      nextWarnings.push('Foto pesada: pode deixar o cadastro mais lento para salvar.');
    }
    if (!file.type.startsWith('image/')) {
      setWarnings(['A foto precisa ser uma imagem válida.']);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const checkedWarnings = [...nextWarnings];
      if (image.width < 600 || image.height < 800) {
        checkedWarnings.push('Foto pequena: pode perder qualidade na impressão da carteirinha.');
      }
      if (image.width > image.height * 1.15) {
        checkedWarnings.push('Foto muito horizontal: prefira uma foto 3x4 vertical.');
      }
      setWarnings(checkedWarnings);
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      setWarnings(['Não foi possível verificar a qualidade da foto.']);
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  }, [file]);

  return warnings;
}
