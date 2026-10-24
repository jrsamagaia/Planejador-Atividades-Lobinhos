// PDF com texto de verdade (selecionável e nítido), gerado no navegador com jsPDF.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Plano, Sessao } from '../../shared/types';
import { carregarImagem, linhaProgressao, nomeArquivo, periodoTexto } from './exportar-comum';

const MARGEM = 14;

// As fontes padrão do PDF usam a codificação WinAnsi: troca o que estiver fora dela.
function limpo(s: string | undefined): string {
  return (s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•●]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

function hexParaRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export async function exportarPdf(plano: Plano, sessao: Sessao) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const util = largura - MARGEM * 2;
  const cor = hexParaRgb(sessao.grupo.cor_primaria);
  const ouro = hexParaRgb(sessao.grupo.cor_secundaria);
  const p = plano.parametros;

  // Cabeçalho
  const logo = await carregarImagem(sessao.grupo.logo_url || '/img/logo-gelb.png').catch(() => null);
  doc.setFillColor(...cor);
  doc.rect(0, 0, largura, 30, 'F');
  doc.setFillColor(...ouro);
  doc.rect(0, 30, largura, 1.2, 'F');
  if (logo) doc.addImage(logo, 'PNG', MARGEM, 5, 20, 20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(limpo(sessao.grupo.nome), MARGEM + (logo ? 24 : 0), 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(limpo(`${sessao.secao.nome}${sessao.grupo.numeral ? ` · ${sessao.grupo.numeral}` : ''} · Ramo Lobinho`), MARGEM + (logo ? 24 : 0), 19.5);

  let y = 42;
  doc.setTextColor(20, 20, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  const tituloLinhas = doc.splitTextToSize(limpo(plano.titulo), util);
  doc.text(tituloLinhas, MARGEM, y);
  y += tituloLinhas.length * 7 + 1;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(90, 90, 100);
  const info = [
    `${plano.tipo_nome ?? 'Atividade'} · ${periodoTexto(plano, sessao)}`,
    `Progressão: ${linhaProgressao(p)}`,
    `Velho Lobo principal: ${p.velhoLoboPrincipal} · Equipe: ${p.equipe.join(', ')}`,
  ];
  for (const l of info) {
    const linhas = doc.splitTextToSize(limpo(l), util);
    doc.text(linhas, MARGEM, y);
    y += linhas.length * 4.6;
  }
  y += 3;

  // Cronograma
  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM, top: 16 },
    head: [['Hora', 'Duração', 'Atividade', 'Responsável', 'Material']],
    body: plano.conteudo.atividades.map((a) => [
      limpo(a.horaInicio),
      limpo(a.duracao),
      limpo([a.dia || a.periodo ? `[${[a.dia, a.periodo].filter(Boolean).join(' · ')}]` : '', a.nome, a.tipo ? `(${a.tipo})` : ''].filter(Boolean).join('\n')),
      limpo(a.responsavel),
      limpo(a.material),
    ]),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, valign: 'top', lineColor: [220, 224, 232], lineWidth: 0.2 },
    headStyles: { fillColor: cor, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 247, 251] },
    columnStyles: { 0: { cellWidth: 14, fontStyle: 'bold' }, 1: { cellWidth: 16 }, 2: { cellWidth: 62 }, 3: { cellWidth: 28 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Utilitários de texto corrido com quebra de página
  const garantir = (h: number) => {
    if (y + h > altura - 16) {
      doc.addPage();
      y = 18;
    }
  };
  const titulo = (t: string, tamanho = 12) => {
    garantir(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(tamanho);
    doc.setTextColor(...cor);
    doc.text(limpo(t), MARGEM, y);
    y += tamanho * 0.5 + 1.5;
  };
  const paragrafo = (texto: string, rotulo?: string) => {
    if (!texto?.trim()) return;
    doc.setFontSize(9.5);
    if (rotulo) {
      garantir(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 70);
      doc.text(limpo(rotulo), MARGEM, y);
      y += 4.4;
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 50);
    for (const linha of doc.splitTextToSize(limpo(texto), util) as string[]) {
      garantir(5);
      doc.text(linha, MARGEM, y);
      y += 4.4;
    }
    y += 2.5;
  };

  titulo('Visão geral', 13);
  paragrafo(plano.conteudo.cicloPrograma, 'Ciclo de Programa');
  paragrafo(plano.conteudo.diferenciacaoEtaria, 'Diferenciação por idade');
  paragrafo(plano.conteudo.recursosMateriais, 'Recursos materiais');
  paragrafo(plano.conteudo.recursosHumanos, 'Equipe e papéis');

  y += 2;
  titulo('Detalhamento das atividades', 13);
  plano.conteudo.atividades.forEach((a, i) => {
    garantir(22);
    doc.setFillColor(...ouro);
    doc.rect(MARGEM, y - 4, 1.2, 6, 'F');
    titulo(`${i + 1}. ${a.horaInicio} · ${a.nome}`, 11);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 110);
    const meta = [a.dia, a.periodo, a.duracao, a.tipo, a.responsavel && `Responsável: ${a.responsavel}`, a.areaDesenvolvimento && `Áreas: ${a.areaDesenvolvimento}`]
      .filter(Boolean)
      .join(' · ');
    for (const l of doc.splitTextToSize(limpo(meta), util) as string[]) {
      garantir(5);
      doc.text(l, MARGEM, y);
      y += 4;
    }
    y += 1.5;
    paragrafo(a.descricao, 'Passo a passo');
    paragrafo(a.material, 'Material');
    paragrafo(a.fundoDeCena, 'Fundo de cena');
    paragrafo(a.planoB ?? '', 'Plano B (chuva)');
    y += 2;
  });

  // Rodapé com numeração
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 150);
    doc.text(limpo(`${plano.titulo} · ${sessao.secao.nome}`), MARGEM, altura - 8);
    doc.text(`${i}/${total}`, largura - MARGEM, altura - 8, { align: 'right' });
  }

  doc.save(`${nomeArquivo(plano)}.pdf`);
}
