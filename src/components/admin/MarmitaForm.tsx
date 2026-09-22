import { useEffect, useState } from 'react';
import { Categoria, Marmita, ProdutoTamanho } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getProductOptionLabels, isBeverageCategory, isDessertCategory } from '@/lib/product-category';
import { cn } from '@/lib/utils';
import { Expand, ImageIcon, Loader2, Plus, Trash2, X } from 'lucide-react';

const MAX_DATABASE_IMAGE_BYTES = 500 * 1024;
const IMAGE_MAX_SIDE_PX = 800;
const IMAGE_QUALITY_STEPS = [0.78, 0.7, 0.62, 0.54, 0.46];
const ALLOWED_DATABASE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface MarmitaFormData {
  nome: string;
  descricao: string;
  preco: number;
  estoque: number;
  disponivel: boolean;
  categoria_id: string | null;
  imagem_url: string | null;
  permite_troca_massa: boolean;
  tamanhos: ProdutoTamanho[];
}

interface MarmitaFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  marmita?: Marmita | null;
  categorias: Categoria[];
  isEditing?: boolean;
  loadingInitialData?: boolean;
  layout?: 'dialog' | 'page';
  onCancel?: () => void;
  onSave: (data: MarmitaFormData) => Promise<boolean>;
}

interface PreviewImage {
  label: string;
  src: string;
}

const DEFAULT_PRODUCT_SIZES: ProdutoTamanho[] = [
  { codigo: 'tamanho_m', nome: 'M', serve: 'Serve 1 pessoa', preco: 0 },
  { codigo: 'tamanho_g', nome: 'G', serve: 'Serve 2 pessoas', preco: 0 },
];

const DEFAULT_BEVERAGE_SIZES: ProdutoTamanho[] = [
  { codigo: 'lata_350ml', nome: 'Lata', serve: '350 ml', preco: 0 },
  { codigo: 'garrafa_600ml', nome: 'Garrafa', serve: '600 ml', preco: 0 },
];

function getEditableImageValue(imageUrl: string | null | undefined) {
  if (!imageUrl?.trim()) {
    return null;
  }

  return /^data:image\//i.test(imageUrl.trim()) ? imageUrl : null;
}

function bytesFromDataUrl(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      result ? resolve(result) : reject(new Error('Imagem inválida.'));
    };
    reader.onerror = () => reject(new Error('Não foi possível ler essa imagem.'));
    reader.readAsDataURL(file);
  });
}

function loadDataUrlImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível carregar essa imagem.'));
    image.src = dataUrl;
  });
}

async function compressImageFile(file: File) {
  const originalDataUrl = await readFileAsDataUrl(file);

  if (!/^data:image\//i.test(originalDataUrl)) {
    throw new Error('Não foi possível ler essa imagem.');
  }

  const image = await loadDataUrlImage(originalDataUrl);
  const scale = Math.min(1, IMAGE_MAX_SIDE_PX / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Não foi possível processar essa imagem.');
  }

  context.drawImage(image, 0, 0, width, height);

  for (const quality of IMAGE_QUALITY_STEPS) {
    const dataUrl = canvas.toDataURL('image/webp', quality);

    if (dataUrl.startsWith('data:image/webp') && bytesFromDataUrl(dataUrl) <= MAX_DATABASE_IMAGE_BYTES) {
      return dataUrl;
    }
  }

  const fallbackDataUrl = canvas.toDataURL('image/jpeg', 0.72);

  if (bytesFromDataUrl(fallbackDataUrl) <= MAX_DATABASE_IMAGE_BYTES) {
    return fallbackDataUrl;
  }

  if (file.size <= MAX_DATABASE_IMAGE_BYTES) {
    return originalDataUrl;
  }

  throw new Error('A imagem deve ter no máximo 500 KB após a otimização.');
}

const getInitialFormData = (marmita?: Marmita | null): MarmitaFormData => ({
  nome: marmita?.nome || '',
  descricao: marmita?.descricao || '',
  preco: marmita?.preco || 0,
  estoque: marmita?.estoque || 0,
  disponivel: marmita?.disponivel ?? true,
  categoria_id: marmita?.categoria_id || null,
  imagem_url: getEditableImageValue(marmita?.imagem_url),
  permite_troca_massa: false,
  tamanhos:
    marmita?.tamanhos && marmita.tamanhos.length > 0
      ? marmita.tamanhos
      : [
          { codigo: 'tamanho_m', nome: 'M', serve: 'Serve 1 pessoa', preco: marmita?.preco || 0 },
          { codigo: 'tamanho_g', nome: 'G', serve: 'Serve 2 pessoas', preco: 0 },
        ],
});

export function MarmitaForm({
  open = true,
  onOpenChange,
  marmita,
  categorias,
  isEditing = false,
  loadingInitialData = false,
  layout = 'dialog',
  onCancel,
  onSave,
}: MarmitaFormProps) {
  const [formData, setFormData] = useState<MarmitaFormData>(getInitialFormData(marmita));
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const selectedImageSrc = formData.imagem_url?.startsWith('data:image/') ? formData.imagem_url : null;
  const isDialogLayout = layout === 'dialog';
  const selectedCategoria = categorias.find((categoria) => categoria.id === formData.categoria_id);
  const categoryContext = selectedCategoria ?? (formData.categoria_id ? { id: formData.categoria_id, nome: formData.categoria_id } : null);
  const isSobremesa = isDessertCategory(categoryContext);
  const isBebida = isBeverageCategory(categoryContext);
  const optionLabels = getProductOptionLabels(categoryContext);

  useEffect(() => {
    if (isDialogLayout && !open) {
      return;
    }

    setFormData(getInitialFormData(marmita));
    setPreviewImage(null);
    setImageUploadError(null);
    setImageProcessing(false);
  }, [isDialogLayout, open, marmita]);

  useEffect(() => {
    if (isSobremesa && formData.tamanhos.length > 0) {
      setFormData((prev) => ({ ...prev, tamanhos: [] }));
      return;
    }

    if (isBebida && (formData.tamanhos.length === 0 || formData.tamanhos.every((tamanho) => tamanho.codigo.startsWith('caixa_')))) {
      setFormData((prev) => ({
        ...prev,
        tamanhos: DEFAULT_BEVERAGE_SIZES.map((tamanho) => ({
          ...tamanho,
          preco: prev.preco,
        })),
      }));
      return;
    }

    if (!isSobremesa && !isBebida && formData.tamanhos.length === 0) {
      setFormData((prev) => ({
        ...prev,
        tamanhos: DEFAULT_PRODUCT_SIZES.map((tamanho) => ({
          ...tamanho,
          preco: prev.preco,
        })),
      }));
    }
  }, [formData.tamanhos, formData.tamanhos.length, isBebida, isSobremesa]);

  const handleRemoveImage = () => {
    setImageUploadError(null);
    setFormData((prev) => ({ ...prev, imagem_url: null }));
  };

  const handleImageFileChange = async (file: File | null) => {
    setImageUploadError(null);

    if (!file) {
      return;
    }

    if (!ALLOWED_DATABASE_IMAGE_TYPES.includes(file.type)) {
      setImageUploadError('Use uma imagem JPG, PNG, WEBP ou GIF.');
      return;
    }

    try {
      setImageProcessing(true);
      const optimizedImage = await compressImageFile(file);
      setFormData((prev) => ({ ...prev, imagem_url: optimizedImage }));
    } catch (error) {
      setImageUploadError(error instanceof Error ? error.message : 'Não foi possível otimizar essa imagem.');
    } finally {
      setImageProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) {
      alert('O nome é obrigatório.');
      return;
    }

    if (formData.preco <= 0) {
      alert('O preço deve ser maior que zero.');
      return;
    }

    if (imageProcessing) {
      alert('Aguarde a otimização da imagem terminar.');
      return;
    }

    const sizesToSave = isSobremesa ? [] : formData.tamanhos;
    const invalidSize = !isSobremesa && sizesToSave.some(
      (tamanho) => !tamanho.nome.trim() || !tamanho.serve.trim() || tamanho.preco <= 0
    );

    if (invalidSize) {
      alert(optionLabels.invalidMessage);
      return;
    }

    setSaving(true);
    const success = await onSave({
      ...formData,
      permite_troca_massa: false,
      tamanhos: sizesToSave,
    });
    setSaving(false);

    if (success) {
      onOpenChange?.(false);
      setFormData(getInitialFormData());
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormData(getInitialFormData());
      setPreviewImage(null);
      setImageUploadError(null);
      setImageProcessing(false);
    }

    onOpenChange?.(nextOpen);
  };

  const updateTamanho = (index: number, field: keyof ProdutoTamanho, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      tamanhos: prev.tamanhos.map((tamanho, currentIndex) =>
        currentIndex === index
          ? {
              ...tamanho,
              [field]: field === 'preco' ? Number(value) || 0 : value,
            }
          : tamanho
      ),
    }));
  };

  const addTamanho = () => {
    setFormData((prev) => {
      const nextNumber = prev.tamanhos.length + 1;
      const nextBeverageVolume = nextNumber === 1 ? 350 : nextNumber === 2 ? 600 : nextNumber * 250;

      return {
        ...prev,
        tamanhos: [
          ...prev.tamanhos,
          isBebida
            ? {
                codigo: `volume_${nextBeverageVolume}ml`,
                nome: `Volume ${nextNumber}`,
                serve: `${nextBeverageVolume} ml`,
                preco: prev.preco,
              }
            : {
                codigo: `caixa_${nextNumber}`,
                nome: `Caixa ${nextNumber}`,
                serve: `Serve ${nextNumber} pessoa${nextNumber > 1 ? 's' : ''}`,
                preco: prev.preco,
              },
        ],
      };
    });
  };

  const removeTamanho = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      tamanhos: prev.tamanhos.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const formContent = (
    <>
      {loadingInitialData ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className={cn('space-y-4 py-4', !isDialogLayout && 'lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.85fr)] lg:items-start lg:gap-6 lg:space-y-0')}>
          <div className={cn('space-y-4', !isDialogLayout && 'lg:order-1')}>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(event) => setFormData((prev) => ({ ...prev, nome: event.target.value }))}
                placeholder="Ex: Nhoque ao Funghi"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(event) => setFormData((prev) => ({ ...prev, descricao: event.target.value }))}
                placeholder="Descreva os ingredientes e detalhes..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={formData.categoria_id || 'none'}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    categoria_id: value === 'none' ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preco">Preço (R$) *</Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.preco}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      preco: parseFloat(event.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estoque">Estoque</Label>
                <Input
                  id="estoque"
                  type="number"
                  min="0"
                  value={formData.estoque}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      estoque: parseInt(event.target.value, 10) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Disponível para venda</Label>
                <p className="text-sm text-muted-foreground">
                  O produto só aparecerá no cardápio se estiver disponível e com estoque maior que zero.
                </p>
              </div>
              <Switch
                checked={formData.disponivel}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, disponivel: checked }))
                }
              />
            </div>

            {!isSobremesa ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label>{optionLabels.sectionTitle}</Label>
                  <p className="text-sm text-muted-foreground">
                    {optionLabels.sectionDescription}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addTamanho}>
                  <Plus className="mr-2 h-4 w-4" />
                  {optionLabels.addLabel}
                </Button>
              </div>

              <div className="space-y-3">
                {formData.tamanhos.map((tamanho, index) => (
                  <div key={`${tamanho.codigo}-${index}`} className="rounded-lg border bg-muted/20 p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr_110px_auto] sm:items-end">
                      <div className="space-y-2">
                        <Label htmlFor={`tamanho-nome-${index}`}>{optionLabels.nameLabel}</Label>
                        <Input
                          id={`tamanho-nome-${index}`}
                          value={tamanho.nome}
                          onChange={(event) => updateTamanho(index, 'nome', event.target.value)}
                          placeholder={optionLabels.namePlaceholder}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`tamanho-serve-${index}`}>{optionLabels.detailLabel}</Label>
                        <Input
                          id={`tamanho-serve-${index}`}
                          value={tamanho.serve}
                          onChange={(event) => updateTamanho(index, 'serve', event.target.value)}
                          placeholder={optionLabels.detailPlaceholder}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`tamanho-preco-${index}`}>Preço</Label>
                        <Input
                          id={`tamanho-preco-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={tamanho.preco}
                          onChange={(event) => updateTamanho(index, 'preco', event.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTamanho(index)}
                        disabled={formData.tamanhos.length <= 1}
                        aria-label="Remover tamanho"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            ) : (
              <div className="rounded-lg border bg-muted/20 p-4">
                <Label>{optionLabels.emptySimpleTitle}</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  {optionLabels.emptySimpleDescription}
                </p>
              </div>
            )}
          </div>

          <div className={cn(!isDialogLayout && 'lg:order-2')}>
            <div className="space-y-2">
              <Label>Imagem</Label>
              <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  {selectedImageSrc ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setPreviewImage({ label: 'Imagem enviada', src: selectedImageSrc })}
                        className="group relative overflow-hidden rounded-xl border bg-background"
                      >
                        <img
                          src={selectedImageSrc}
                          alt="Preview da imagem enviada"
                          className="h-40 w-40 object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/65 px-3 py-2 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <Expand className="h-3.5 w-3.5" />
                          Ver ampliada
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -right-2 -top-2 h-7 w-7"
                        onClick={handleRemoveImage}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex h-40 w-40 items-center justify-center rounded-xl border-2 border-dashed bg-background">
                      <div className="space-y-2 px-4 text-center">
                        <div className="flex justify-center">
                          <ImageIcon className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">Nenhuma imagem enviada</p>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="font-medium">
                        {selectedImageSrc ? 'Imagem própria do produto' : 'Card limpo, sem imagem herdada'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        A edição não carrega mais a galeria antiga do projeto de marmitas. Envie uma imagem nova somente se quiser exibi-la no produto.
                      </p>
                    </div>
                    <div className="space-y-2 rounded-lg border bg-background p-3">
                      <Label htmlFor="imagem-upload">Enviar imagem</Label>
                      <Input
                        id="imagem-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(event) => {
                          handleImageFileChange(event.target.files?.[0] ?? null);
                          event.currentTarget.value = '';
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        A imagem será redimensionada para até 800 px e salva com no máximo 500 KB. Formatos: JPG, PNG, WEBP ou GIF.
                      </p>
                      {imageProcessing ? (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Otimizando imagem...
                        </p>
                      ) : null}
                      {imageUploadError ? (
                        <p className="text-sm text-destructive">{imageUploadError}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', isDialogLayout && 'pt-2')}>
        <Button variant="outline" onClick={() => (isDialogLayout ? onOpenChange?.(false) : onCancel?.())}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saving || loadingInitialData || imageProcessing}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {isEditing ? 'Salvar alterações' : 'Criar produto'}
        </Button>
      </div>
    </>
  );

  const previewDialog = (
    <Dialog open={!!previewImage} onOpenChange={(nextOpen) => !nextOpen && setPreviewImage(null)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{previewImage?.label || 'Preview da imagem'}</DialogTitle>
          <DialogDescription>
            Visualização ampliada da imagem enviada para o produto.
          </DialogDescription>
        </DialogHeader>

        {previewImage ? (
          <div className="overflow-hidden rounded-xl border bg-muted/30">
            <img
              src={previewImage.src}
              alt={previewImage.label}
              className="max-h-[70vh] w-full object-contain"
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );

  if (!isDialogLayout) {
    return (
      <>
        {formContent}
        {previewDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar produto' : 'Novo produto'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Atualize os dados do produto' : 'Preencha os dados do novo produto'}
            </DialogDescription>
          </DialogHeader>

          {formContent}
        </DialogContent>
      </Dialog>
      {previewDialog}
    </>
  );
}
