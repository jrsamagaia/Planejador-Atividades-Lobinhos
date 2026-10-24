import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, PageOrientation } from 'docx';
import { saveAs } from 'file-saver';
import { ActivityPlan } from '../types';

export async function exportToDocx(plan: ActivityPlan, dateStr: string, theme: string, progressao: string) {
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ children: [new Paragraph({ text: "#", alignment: AlignmentType.CENTER })], width: { size: 5, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Hora", alignment: AlignmentType.CENTER })], width: { size: 10, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Duração", alignment: AlignmentType.CENTER })], width: { size: 10, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Tipo", alignment: AlignmentType.CENTER })], width: { size: 15, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Atividade", alignment: AlignmentType.CENTER })], width: { size: 25, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Responsável", alignment: AlignmentType.CENTER })], width: { size: 15, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Material", alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
      ],
    }),
  ];

  plan.atividades.forEach((act, index) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: String(index + 1), alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: act.horaInicio, alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: act.duracao, alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: act.tipo, alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: act.nome, alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: act.responsavel, alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: act.material, alignment: AlignmentType.CENTER })] }),
        ],
      })
    );
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
  });

  const detailedActivities = plan.atividades.flatMap((act, index) => [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: `ATIVIDADE ${index + 1}: ${act.nome.toUpperCase()}`, bold: true })],
      spacing: { before: 300, after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Área de desenvolvimento: ", bold: true }),
        new TextRun({ text: act.areaDesenvolvimento }),
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Descrição da atividade: ", bold: true }),
        new TextRun({ text: act.descricao }),
      ],
      spacing: { after: 100 }
    }),
    ...(act.planoB ? [
      new Paragraph({
        children: [
          new TextRun({ text: "Plano B (Chuva / Espaço Coberto): ", bold: true, color: "003366" }),
          new TextRun({ text: act.planoB, italics: true }),
        ],
        spacing: { after: 100 }
      })
    ] : []),
    new Paragraph({
      children: [
        new TextRun({ text: "Fundo de Cena: ", bold: true }),
        new TextRun({ text: act.fundoDeCena }),
      ],
      spacing: { after: 200 }
    }),
  ]);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Programação de Atividade - Ramo Lobinho", bold: true, color: "003366" })],
            spacing: { after: 200 }
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Data: ${dateStr} | Tema: ${theme} | Progressão: ${progressao}`, italics: true })],
            spacing: { after: 400 }
          }),
          
          new Paragraph({
            children: [new TextRun({ text: "Recursos Materiais Necessários: ", bold: true }), new TextRun({ text: plan.recursosMateriais })],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [new TextRun({ text: "Recursos Humanos Necessários: ", bold: true }), new TextRun({ text: plan.recursosHumanos })],
            spacing: { after: 300 }
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Programação:", bold: true })],
            spacing: { after: 200 }
          }),
          
          table,
          
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Detalhamento das atividades:", bold: true })],
            spacing: { before: 400, after: 200 }
          }),
          
          ...detailedActivities,

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "O Ciclo de Programa", bold: true })],
            spacing: { before: 400, after: 100 },
            pageBreakBefore: true
          }),
          new Paragraph({ text: plan.cicloPrograma }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Diferenciação Etária", bold: true })],
            spacing: { before: 400, after: 100 }
          }),
          new Paragraph({ text: plan.diferenciacaoEtaria }),

        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Programacao_Lobinho_${dateStr.replace(/\//g, '-')}.docx`);
}
