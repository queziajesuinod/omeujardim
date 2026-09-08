// Rota pública /termos. O texto vem do painel (documento_legal, chave "termos").
import { PaginaLegal } from '../componentes/PaginaLegal';

export default function Termos() {
  return <PaginaLegal chave="termos" />;
}
