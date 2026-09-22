// Produto do catálogo.
export interface Marmita {
  id: string;
  nome: string;
  descricao: string | null;
  categoria_id: string | null;
  preco: number;
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
  estoque: number | null;
  disponivel: boolean | null;
  imagem_url: string | null;
  created_at: string | null;
}

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
  paymentMethod?: 'pix' | 'cartao_credito';
}
