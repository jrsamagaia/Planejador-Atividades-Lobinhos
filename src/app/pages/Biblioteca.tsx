import { CloudDownload, Download, ExternalLink, FileText, FolderPlus, Library, Loader2, Pencil, Search, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CategoriaBiblioteca, ItemBiblioteca } from '../../shared/types';
import { api } from '../api';
import { Cabecalho, Carregando, confirmar, Modal, Selo, Vazio } from '../components/ui';
import { formatarTamanho, useSessao } from '../lib/contexto';

interface Dados {
  categorias: CategoriaBiblioteca[];
  itens: ItemBiblioteca[];
}

export function Biblioteca() {
  const { sessao, avisar } = useSessao();
  const admin = sessao.usuario.papel === 'admin';
  const [dados, setDados] = useState<Dados | null>(null);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState(0);
  const [envio, setEnvio] = useState(false);
  const [editando, setEditando] = useState<ItemBiblioteca | null>(null);
  const [categoriasAberto, setCategoriasAberto] = useState(false);
  const [importando, setImportando] = useState<{ feitos: number; total: number } | null>(null);

  const carregar = useCallback(() => api.get<Dados>('/biblioteca').then(setDados, (e) => avisar(e.message, 'erro')), [avisar]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (dados?.itens ?? []).filter((i) => (!categoria || i.categoria_id === categoria) && (!t || `${i.titulo} ${i.descricao}`.toLowerCase().includes(t)));
  }, [dados, q, categoria]);

  const pendentes = (dados?.itens ?? []).filter((i) => !i.disponivel && i.url_origem);

  async function importarTodos() {
    setImportando({ feitos: 0, total: pendentes.length });
    let falhas = 0;
    for (const [n, item] of pendentes.entries()) {
      try {
        const atualizado = await api.post<ItemBiblioteca>(`/biblioteca/${item.id}/importar`);
        setDados((d) => d && { ...d, itens: d.itens.map((x) => (x.id === item.id ? atualizado : x)) });
      } catch {
        falhas++;
      }
      setImportando({ feitos: n + 1, total: pendentes.length });
    }
    setImportando(null);
    avisar(falhas ? `${falhas} arquivo(s) não puderam ser importados. Envie-os manualmente.` : 'Biblioteca importada!', falhas ? 'erro' : 'ok');
  }

  async function excluir(item: ItemBiblioteca) {
    if (!confirmar(`Excluir "${item.titulo}"? O arquivo será apagado.`)) return;
    try {
      await api.del(`/biblioteca/${item.id}`);
      setDados((d) => d && { ...d, itens: d.itens.filter((x) => x.id !== item.id) });
      avisar('Material excluído.');
    } catch (e) {
      avisar((e as Error).message, 'erro');
    }
  }

  if (!dados) return <Carregando />;

  return (
    <div>
      <Cabecalho
        titulo="Biblioteca"
        subtitulo="Materiais da Alcateia. Só quem tem acesso ao planejador consegue abrir."
        acoes={
          admin && (
            <>
              <button className="btn-secundario" onClick={() => setCategoriasAberto(true)}>
                <FolderPlus className="size-4" /> Categorias
              </button>
              <button className="btn-primario" onClick={() => setEnvio(true)} disabled={!dados.categorias.length}>
                <Upload className="size-4" /> Enviar arquivo
              </button>
            </>
          )
        }
      />

      {admin && pendentes.length > 0 && (
        <div className="cartao mb-5 flex flex-col gap-3 border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
          <CloudDownload className="size-6 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm text-amber-900">
            <strong>{pendentes.length} materiais</strong> ainda estão no site antigo (WordPress). Importe para guardá-los aqui, de forma privada.
            {importando && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-200">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${(importando.feitos / importando.total) * 100}%` }} />
              </div>
            )}
          </div>
          <button className="btn bg-amber-500 text-white hover:bg-amber-600" onClick={importarTodos} disabled={Boolean(importando)}>
            {importando ? (
              <>
                <Loader2 className="size-4 animate-spin" /> {importando.feitos}/{importando.total}
              </>
            ) : (
              'Importar todos'
            )}
          </button>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className="campo pl-9" placeholder="Buscar na biblioteca" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button className={!categoria ? 'chip-on' : 'chip-off'} onClick={() => setCategoria(0)}>
            Todas
          </button>
          {dados.categorias.map((c) => (
            <button key={c.id} className={`${categoria === c.id ? 'chip-on' : 'chip-off'} shrink-0`} onClick={() => setCategoria(categoria === c.id ? 0 : c.id)}>
              {c.nome}
            </button>
          ))}
        </div>
      </div>

      {dados.itens.length === 0 ? (
        <Vazio icone={<Library className="size-7" />} titulo="Biblioteca vazia">
          {admin ? 'Comece criando uma categoria e enviando os primeiros arquivos.' : 'O administrador ainda não enviou materiais.'}
        </Vazio>
      ) : filtrados.length === 0 ? (
        <p className="py-10 text-center text-slate-500">Nada encontrado.</p>
      ) : (
        <div className="space-y-6">
          {dados.categorias
            .filter((c) => filtrados.some((i) => i.categoria_id === c.id))
            .map((c) => (
              <section key={c.id}>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">{c.nome}</h2>
                <ul className="cartao divide-y divide-slate-100">
                  {filtrados
                    .filter((i) => i.categoria_id === c.id)
                    .map((i) => (
                      <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={`rounded-lg p-2 ${i.disponivel ? 'bg-marca/10 text-marca' : 'bg-slate-100 text-slate-400'}`}>
                          <FileText className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {i.disponivel ? (
                            <a href={`/api/biblioteca/${i.id}/arquivo`} target="_blank" rel="noopener" className="font-medium text-slate-900 hover:text-marca hover:underline">
                              {i.titulo}
                            </a>
                          ) : (
                            <span className="font-medium text-slate-500">{i.titulo}</span>
                          )}
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {!i.disponivel && <Selo cor="ouro">aguardando importação</Selo>}
                            {i.tamanho ? <span>{formatarTamanho(i.tamanho)}</span> : null}
                            {i.descricao && <span className="truncate">{i.descricao}</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center">
                          {i.disponivel && (
                            <>
                              <a className="btn-fantasma hidden p-2 sm:inline-flex" href={`/api/biblioteca/${i.id}/arquivo`} target="_blank" rel="noopener" title="Abrir" aria-label="Abrir">
                                <ExternalLink className="size-4" />
                              </a>
                              <a className="btn-fantasma p-2" href={`/api/biblioteca/${i.id}/arquivo?baixar=1`} title="Baixar" aria-label="Baixar">
                                <Download className="size-4" />
                              </a>
                            </>
                          )}
                          {admin && (
                            <>
                              <button className="btn-fantasma p-2" onClick={() => setEditando(i)} title="Editar" aria-label="Editar">
                                <Pencil className="size-4" />
                              </button>
                              <button className="btn-perigo p-2" onClick={() => excluir(i)} title="Excluir" aria-label="Excluir">
                                <Trash2 className="size-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      {admin && (
        <>
          <ModalEnvio
            aberto={envio}
            categorias={dados.categorias}
            categoriaInicial={categoria || dados.categorias[0]?.id}
            aoFechar={() => setEnvio(false)}
            aoEnviar={(item) => setDados((d) => d && { ...d, itens: [...d.itens, item].sort((a, b) => a.titulo.localeCompare(b.titulo)) })}
          />
          {editando && (
            <ModalEdicao
              item={editando}
              categorias={dados.categorias}
              aoFechar={() => setEditando(null)}
              aoSalvar={(item) => setDados((d) => d && { ...d, itens: d.itens.map((x) => (x.id === item.id ? item : x)) })}
            />
          )}
          <ModalCategorias aberto={categoriasAberto} categorias={dados.categorias} itens={dados.itens} aoFechar={() => setCategoriasAberto(false)} aoMudar={carregar} />
        </>
      )}
    </div>
  );
}

function ModalEnvio({
  aberto,
  categorias,
  categoriaInicial,
  aoFechar,
  aoEnviar,
}: {
  aberto: boolean;
  categorias: CategoriaBiblioteca[];
  categoriaInicial?: number;
  aoFechar: () => void;
  aoEnviar: (i: ItemBiblioteca) => void;
}) {
  const { avisar } = useSessao();
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [categoria, setCategoria] = useState(categoriaInicial ?? 0);
  const [titulo, setTitulo] = useState('');
  const [enviando, setEnviando] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      setArquivos([]);
      setTitulo('');
      setCategoria(categoriaInicial ?? categorias[0]?.id ?? 0);
    }
  }, [aberto, categoriaInicial, categorias]);

  async function enviar() {
    let ok = 0;
    for (const [n, f] of arquivos.entries()) {
      setEnviando(n + 1);
      const form = new FormData();
      form.append('arquivo', f);
      form.append('categoria_id', String(categoria));
      if (arquivos.length === 1 && titulo.trim()) form.append('titulo', titulo.trim());
      try {
        aoEnviar(await api.post<ItemBiblioteca>('/biblioteca', form));
        ok++;
      } catch (e) {
        avisar(`${f.name}: ${(e as Error).message}`, 'erro');
      }
    }
    setEnviando(0);
    if (ok) {
      avisar(ok === 1 ? 'Arquivo enviado.' : `${ok} arquivos enviados.`);
      aoFechar();
    }
  }

  return (
    <Modal
      titulo="Enviar para a biblioteca"
      aberto={aberto}
      aoFechar={() => !enviando && aoFechar()}
      rodape={
        <>
          <button className="btn-secundario" onClick={aoFechar} disabled={Boolean(enviando)}>
            Cancelar
          </button>
          <button className="btn-primario" onClick={enviar} disabled={!arquivos.length || !categoria || Boolean(enviando)}>
            {enviando ? (
              <>
                <Loader2 className="size-4 animate-spin" /> {enviando}/{arquivos.length}
              </>
            ) : (
              'Enviar'
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          onDragOver={(e) => (e.preventDefault(), setArrastando(true))}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            setArquivos([...e.dataTransfer.files]);
          }}
          onClick={() => input.current?.click()}
          className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${arrastando ? 'border-marca bg-marca/5' : 'border-slate-300 hover:border-marca/50'}`}
        >
          <Upload className="mb-2 size-8 text-marca" />
          {arquivos.length ? (
            <p className="text-sm font-medium">{arquivos.length === 1 ? arquivos[0].name : `${arquivos.length} arquivos selecionados`}</p>
          ) : (
            <>
              <p className="font-semibold">Arraste os arquivos aqui</p>
              <p className="text-sm text-slate-500">ou toque para escolher · PDF, Word, imagem, texto ou MP3 · até 95 MB</p>
            </>
          )}
          <input ref={input} type="file" multiple hidden accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.mp3" onChange={(e) => setArquivos([...(e.target.files ?? [])])} />
        </div>
        {arquivos.length === 1 && (
          <div>
            <label className="rotulo" htmlFor="env-t">
              Título
            </label>
            <input id="env-t" className="campo" placeholder={arquivos[0].name.replace(/\.[^.]+$/, '')} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
        )}
        <div>
          <label className="rotulo" htmlFor="env-c">
            Categoria
          </label>
          <select id="env-c" className="campo" value={categoria} onChange={(e) => setCategoria(Number(e.target.value))}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <p className="ajuda">Para o Gemini usar o material ao planejar, prefira PDF. Documentos escaneados também funcionam.</p>
      </div>
    </Modal>
  );
}

function ModalEdicao({ item, categorias, aoFechar, aoSalvar }: { item: ItemBiblioteca; categorias: CategoriaBiblioteca[]; aoFechar: () => void; aoSalvar: (i: ItemBiblioteca) => void }) {
  const { avisar } = useSessao();
  const [titulo, setTitulo] = useState(item.titulo);
  const [descricao, setDescricao] = useState(item.descricao);
  const [categoria, setCategoria] = useState(item.categoria_id);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      aoSalvar(await api.patch<ItemBiblioteca>(`/biblioteca/${item.id}`, { titulo, descricao, categoria_id: categoria }));
      aoFechar();
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      titulo="Editar material"
      aberto
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="btn-primario" onClick={salvar} disabled={salvando || !titulo.trim()}>
            Salvar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="rotulo" htmlFor="ed-t">
            Título
          </label>
          <input id="ed-t" className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="ed-d">
            Descrição (opcional)
          </label>
          <textarea id="ed-d" className="campo" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="ed-c">
            Categoria
          </label>
          <select id="ed-c" className="campo" value={categoria} onChange={(e) => setCategoria(Number(e.target.value))}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

function ModalCategorias({
  aberto,
  categorias,
  itens,
  aoFechar,
  aoMudar,
}: {
  aberto: boolean;
  categorias: CategoriaBiblioteca[];
  itens: ItemBiblioteca[];
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { avisar } = useSessao();
  const [nova, setNova] = useState('');

  async function acao(f: () => Promise<unknown>) {
    try {
      await f();
      aoMudar();
    } catch (e) {
      avisar((e as Error).message, 'erro');
    }
  }

  return (
    <Modal titulo="Categorias" aberto={aberto} aoFechar={aoFechar}>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nova.trim()) acao(() => api.post('/biblioteca/categorias', { nome: nova })).then(() => setNova(''));
        }}
      >
        <input className="campo" placeholder="Nova categoria" value={nova} onChange={(e) => setNova(e.target.value)} />
        <button className="btn-primario shrink-0" disabled={!nova.trim()}>
          Adicionar
        </button>
      </form>
      <ul className="divide-y divide-slate-100">
        {categorias.map((c) => {
          const qtd = itens.filter((i) => i.categoria_id === c.id).length;
          return (
            <li key={c.id} className="flex items-center gap-2 py-2">
              <span className="flex-1 font-medium">{c.nome}</span>
              <span className="text-xs text-slate-500">{qtd} itens</span>
              <button
                className="btn-fantasma p-2"
                aria-label={`Renomear ${c.nome}`}
                onClick={() => {
                  const nome = prompt('Novo nome da categoria', c.nome);
                  if (nome?.trim()) acao(() => api.patch(`/biblioteca/categorias/${c.id}`, { nome }));
                }}
              >
                <Pencil className="size-4" />
              </button>
              <button
                className="btn-perigo p-2"
                aria-label={`Excluir ${c.nome}`}
                disabled={qtd > 0}
                title={qtd > 0 ? 'Mova os materiais antes de excluir' : 'Excluir'}
                onClick={() => confirmar(`Excluir a categoria "${c.nome}"?`) && acao(() => api.del(`/biblioteca/categorias/${c.id}`))}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
