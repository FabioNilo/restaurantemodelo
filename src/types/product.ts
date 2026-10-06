// Produto do catálogo.
export interface Marmita {
  id: string;
  nome: string;
  descricao: string | null;
  categoria_id: string | null;
  preco: number;
  // Só nas telas do admin; o catálogo público nunca recebe o custo.
  custo?: number | null;
  estoque: number | null;
  disponivel: boolean | null;
  imagem_url: string | null;
  permite_troca_massa?: boolean | null;
  tamanhos?: ProdutoTamanho[];
  created_at: string | null;
  updated_at: string | null;
}

export interface MarmitaListItem {
  id: string;
  nome: string;
  descricao: string | null;
  categoria_id: string | null;
  preco: number;
  estoque: number | null;
  imagem_url: string | null;
  disponivel: boolean | null;
  permite_troca_massa?: boolean | null;
  tamanhos?: ProdutoTamanho[];
}

export interface MarmitaAdminListItem {
  id: string;
  nome: string;
  categoria_id: string | null;
  preco: number;
  custo?: number | null;
  estoque: number | null;
  disponivel: boolean | null;
  imagem_url: string | null;
  tamanhos?: ProdutoTamanho[];
  created_at: string | null;
}

// Filtros da lista de produtos no admin. categoria_id 'sem-categoria' = produtos sem categoria.
export interface MarmitaFiltros {
  busca?: string;
  categoria_id?: string;
  foto?: 'com' | 'sem';
  disponibilidade?: 'disponivel' | 'indisponivel';
  sem_custo?: boolean;
  estoque?: 'baixo' | 'zerado';
}

// Mesmo limite do servidor (server/catalog.ts): estoque "baixo" é de 1 a 5 unidades.
export const ESTOQUE_BAIXO = 5;
export const MAX_PRODUTOS_LOTE = 25;

// Uma linha salva pela edição em lote: só os campos que mudaram.
export interface ProdutoLoteAlteracao {
  id: string;
  preco?: number;
  custo?: number | null;
  opcoes?: Array<{ codigo: string; preco: number }>;
}

export const SEM_CATEGORIA = 'sem-categoria';

// Categoria do catálogo.
export interface Categoria {
  id: string;
  nome: string;
  ativo: boolean | null;
  ordem: number | null;
  created_at: string | null;
}

export interface CategoriaListItem {
  id: string;
  nome: string;
  ordem: number | null;
}

// Cart item for local state
export interface CartItem {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
  imagem_url: string | null;
  tamanho_codigo?: string;
  tamanho_nome?: string;
  tamanho_serve?: string;
}

export interface ProdutoTamanho {
  codigo: string;
  nome: string;
  serve: string;
  preco: number;
}

export interface CustomerData {
  name: string;
  phone: string;
  address: string;
  neighborhood: string;
  complement?: string;
  observations?: string;
  paymentMethod?: 'pix' | 'cartao_debito' | 'cartao_credito';
}
