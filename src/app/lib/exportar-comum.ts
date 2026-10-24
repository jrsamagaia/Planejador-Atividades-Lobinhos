import type { ParametrosPlano, Plano, Sessao } from '../../shared/types';
import { formatarPeriodo } from './contexto';

export async function carregarImagem(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = falha;
    r.readAsDataURL(blob);
  });
}

export async function carregarBytes(url: string): Promise<ArrayBuffer> {
  return (await fetch(url)).arrayBuffer();
}

export function linhaProgressao(p: ParametrosPlano): string {
  return [p.caminho, p.eixo, p.bloco].every((x) => x === 'Todos') ? 'Todos os caminhos e eixos' : `${p.caminho} · ${p.eixo} · ${p.bloco}`;
}

export function periodoTexto(plano: Plano, sessao: Sessao): string {
  const tipo = sessao.tipos.find((t) => t.id === plano.tipo_id);
  const datas = formatarPeriodo(plano.data_inicio, plano.data_fim);
  return tipo?.modo === 'bloco' ? `${datas}, das ${plano.parametros.horaInicio} às ${plano.parametros.horaFim}` : datas;
}

export function nomeArquivo(plano: Plano): string {
  const base = plano.titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${plano.data_inicio}_${base || 'plano'}`;
}

export function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
