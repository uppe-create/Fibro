import { useEffect, useState } from 'react';
import type { FieldError, UseFormRegister } from 'react-hook-form';
import { CheckCircle2, Eye, File as FileIcon, UploadCloud, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatFileSize, type FormData } from '@/lib/cadastro-utils';

type FileUploadFieldProps = {
  id: string;
  label: string;
  accept: string;
  error?: FieldError;
  fileValue: FileList | null | undefined;
  fieldName: keyof FormData;
  register: UseFormRegister<FormData>;
  onRemove: (fieldName: keyof FormData) => void;
  progress: number;
  isSubmitting: boolean;
};

export const HEAVY_FILE_WARNING_BYTES = 3 * 1024 * 1024;

export function isHeavyFile(file?: File | null) {
  return Boolean(file && file.size >= HEAVY_FILE_WARNING_BYTES);
}

export function FileUploadField({
  id,
  label,
  accept,
  error,
  fileValue,
  fieldName,
  register,
  onRemove,
  progress,
  isSubmitting
}: FileUploadFieldProps) {
  const file = fileValue?.[0];
  const hasFile = Boolean(file);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const isImage = Boolean(file?.type?.startsWith('image/'));
  const canPreview = hasFile && Boolean(previewUrl);

  return (
    <div className="space-y-3">
      <div className="ml-1 flex items-center justify-between">
        <Label htmlFor={id} className="text-[#5E6B7A]">
          {label}
        </Label>
        {hasFile && (
          <span className="flex animate-in items-center text-xs font-medium text-green-700 fade-in slide-in-from-right-2">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Selecionado
          </span>
        )}
      </div>

      <div className="group relative">
        {!hasFile ? (
          <>
            <Input id={id} type="file" accept={accept} {...register(fieldName)} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
            <div className="flex h-24 items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 transition-all group-hover:border-blue-300 group-hover:bg-blue-50/30">
              <UploadCloud className="h-5 w-5 text-gray-400 transition-colors group-hover:text-blue-500" />
              <span className="text-sm font-medium text-gray-500 transition-colors group-hover:text-blue-600">Clique para anexar arquivo</span>
            </div>
          </>
        ) : (
          <div className="animate-in rounded-xl border-2 border-green-200 bg-green-50/40 p-3 duration-200 zoom-in-95">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="shrink-0 rounded-lg bg-green-100 p-2 text-green-700">
                  <FileIcon className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <p className="max-w-[170px] truncate text-sm font-medium text-green-900 sm:max-w-[240px]">{file?.name}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-green-700">{formatFileSize(file?.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canPreview && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')} className="h-8 w-8 rounded-full text-blue-700 hover:bg-blue-100 hover:text-blue-900" title="Pré-visualizar">
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(fieldName)} className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700" title="Remover arquivo">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isImage && previewUrl && (
              <div className="mt-3 max-h-36 overflow-hidden rounded-lg border border-green-200 bg-white">
                <img src={previewUrl} alt={`Prévia ${label}`} className="h-36 w-full object-cover" />
              </div>
            )}

            {isHeavyFile(file) && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                Arquivo pesado ({formatFileSize(file?.size)}). Pode demorar um pouco para salvar; se travar, tente uma foto/arquivo menor.
              </div>
            )}

            {isSubmitting && (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-green-100">
                  <div className="h-2 bg-green-600 transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                </div>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-green-700">Upload: {Math.round(progress)}%</p>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="ml-1 text-sm text-red-500">{error.message}</p>}
    </div>
  );
}
