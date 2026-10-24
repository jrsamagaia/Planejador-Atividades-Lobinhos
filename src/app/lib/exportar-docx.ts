// Documento do Word (.docx) editável, gerado no navegador.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { Plano, Sessao } from '../../shared/types';
import { baixar, carregarBytes, linhaProgressao, nomeArquivo, periodoTexto } from './exportar-comum';

const cor = (hex: string) => hex.replace('#', '').toUpperCase();

function paragrafos(texto: string | undefined, opcoes: { tamanho?: number } = {}): Paragraph[] {
  return (texto ?? '')
    .split(/\n+/)
    .filter((l) => l.trim())
    .map((l) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: l.trim(), size: opcoes.tamanho ?? 21 })] }));
}

function rotulado(rotulo: string, texto: string | undefined, corRotulo: string): Paragraph[] {
  if (!texto?.trim()) return [];
  return [new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: rotulo, bold: true, size: 20, color: corRotulo })] }), ...paragrafos(texto)];
}

export async function exportarDocx(plano: Plano, sessao: Sessao) {
  const primaria = cor(sessao.grupo.cor_primaria);
  const p = plano.parametros;
  const logo = await carregarBytes(sessao.grupo.logo_url || '/img/logo-gelb.png').catch(() => null);

  const celula = (texto: string, opcoes: { cabecalho?: boolean; largura: number; negrito?: boolean }) =>
    new TableCell({
      width: { size: opcoes.largura, type: WidthType.PERCENTAGE },
      shading: opcoes.cabecalho ? { type: ShadingType.CLEAR, color: 'auto', fill: primaria } : undefined,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: texto.split('\n').map(
        (l) => new Paragraph({ children: [new TextRun({ text: l, size: 18, bold: opcoes.cabecalho || opcoes.negrito, color: opcoes.cabecalho ? 'FFFFFF' : undefined })] }),
      ),
    });

  const larguras = [9, 10, 37, 18, 26];
  const tabela = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'D0D5E0' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D0D5E0' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'D0D5E0' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'D0D5E0' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'D0D5E0' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'D0D5E0' },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: ['Hora', 'Duração', 'Atividade', 'Responsável', 'Material'].map((t, i) => celula(t, { cabecalho: true, largura: larguras[i] })),
      }),
      ...plano.conteudo.atividades.map(
        (a) =>
          new TableRow({
            cantSplit: true,
            children: [
              celula(a.horaInicio, { largura: larguras[0], negrito: true }),
              celula(a.duracao, { largura: larguras[1] }),
              celula([[a.dia, a.periodo].filter(Boolean).join(' · '), a.nome, a.tipo && `(${a.tipo})`].filter(Boolean).join('\n'), { largura: larguras[2] }),
              celula(a.responsavel, { largura: larguras[3] }),
              celula(a.material, { largura: larguras[4] }),
            ],
          }),
      ),
    ],
  });

  const cabecalho: Paragraph[] = [];
  if (logo)
    cabecalho.push(
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 72, height: 72 } })] }),
    );
  cabecalho.push(
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sessao.grupo.nome, bold: true, size: 24, color: primaria })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: `${sessao.secao.nome}${sessao.grupo.numeral ? ` · ${sessao.grupo.numeral}` : ''} · Ramo Lobinho`, size: 20, color: '666666' })],
    }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: plano.titulo, bold: true, size: 40, color: '1A1A24' })] }),
    ...[
      `${plano.tipo_nome ?? 'Atividade'} · ${periodoTexto(plano, sessao)}`,
      `Progressão: ${linhaProgressao(p)}`,
      `Velho Lobo principal: ${p.velhoLoboPrincipal} · Equipe: ${p.equipe.join(', ')}`,
    ].map((t) => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: t, size: 19, color: '555555' })] })),
    new Paragraph({ text: '' }),
  );

  const detalhes = plano.conteudo.atividades.flatMap((a, i) => [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 60 },
      children: [new TextRun({ text: `${i + 1}. ${a.horaInicio} · ${a.nome}`, bold: true, size: 24, color: primaria })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: [a.dia, a.periodo, a.duracao, a.tipo, a.responsavel && `Responsável: ${a.responsavel}`, a.areaDesenvolvimento && `Áreas: ${a.areaDesenvolvimento}`]
            .filter(Boolean)
            .join(' · '),
          italics: true,
          size: 18,
          color: '666666',
        }),
      ],
    }),
    ...rotulado('Passo a passo', a.descricao, primaria),
    ...rotulado('Material', a.material, primaria),
    ...rotulado('Fundo de cena', a.fundoDeCena, primaria),
    ...rotulado('Plano B (chuva)', a.planoB, primaria),
  ]);

  const doc = new Document({
    creator: sessao.grupo.nome,
    title: plano.titulo,
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [
      {
        properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `${plano.titulo} · página `, size: 16, color: '999999' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '999999' }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...cabecalho,
          new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 120 }, children: [new TextRun({ text: 'Cronograma', bold: true, size: 28, color: primaria })] }),
          tabela,
          new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 120 }, children: [new TextRun({ text: 'Visão geral', bold: true, size: 28, color: primaria })] }),
          ...rotulado('Ciclo de Programa', plano.conteudo.cicloPrograma, primaria),
          ...rotulado('Diferenciação por idade', plano.conteudo.diferenciacaoEtaria, primaria),
          ...rotulado('Recursos materiais', plano.conteudo.recursosMateriais, primaria),
          ...rotulado('Equipe e papéis', plano.conteudo.recursosHumanos, primaria),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 120 },
            children: [new TextRun({ text: 'Detalhamento das atividades', bold: true, size: 28, color: primaria })],
          }),
          ...detalhes,
        ],
      },
    ],
  });

  baixar(await Packer.toBlob(doc), `${nomeArquivo(plano)}.docx`);
}
