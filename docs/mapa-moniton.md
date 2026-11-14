# Mapa do MonitON — engenharia reversa da estrutura

Fonte: https://moniton.com.br (conta de teste "gestao", papel ADMIN).
Mapeado em 14/11/2026 só com GET (nada foi alterado no sistema deles).
Acesso em `~/Segredos-Claude/moniton.txt`. Nomes de chave/token só pelo nome do parâmetro, nunca o valor.

## O que é o MonitON

PWA em PHP/Apache chamado "Personal Educador" — plano de estudo, metas e resultados por aluno.
Não é um portal institucional: é um **tutor particular em plataforma**, onde a escola cadastra alunos
e vende cursos (oficiais e reforço), com IA por toda parte.

- PWA com gatekeeper: antes de mostrar qualquer coisa, ele esconde a página (`html{visibility:hidden}`),
  detecta app instalado (standalone / cookie / `getInstalledRelatedApps`) e abre o alvo num modal-iframe.
- Login: e-mail **ou código de usuário** + senha de **no máximo 6 caracteres** (`testelogincrj.php`).
- Login automático por link `login_link.php?id=N&csrf=...`: token expira em ~30 s, salva e-mail/senha
  em `localStorage` (username/password) e vai para `personal_api.php?ls_sync=1`.
- Sessão PHP (`PHPSESSID`) para o painel; credenciais do aluno ficam também em `localStorage`
  e cookies (`eh_escola`, `eh_personal`, `home_scooler`).
- Troca de papel dentro do mesmo login: `personal_api.php?moniton_papel=ALUNO|PROFESSOR|ADMIN&moniton_trocar=1`
  (e `moniton_usuario_id` para assumir o papel de outro usuário).

## Rotas mapeadas (todas sob /crj/)

### Portal / landing
| Rota | Função |
|---|---|
| `/` | Gatekeeper PWA → abre `crj.php` em modal-iframe fullscreen |
| `crj.php` | Landing público: seções início, aluno, professores, vitrine, vantagens, login (modal), rodapé; vídeo inline com player próprio; botão "Quero aproveitar" → `crjrecebecadastrar.php`; teacher flutuante público (`teacher.php?publico=1&flutuante=1`) |
| `login_link.php` | Login automático 1× (~30 s) via id+csrf |
| `esqueceusenha.php` | Recuperação de senha |
| `crjrecebecadastrar.php` / `crjrecebecadastrar_personal.php` | Cadastro (escola/personal) |
| `crj2.php?ids_posts=` | Posts públicos do conteúdo |
| `o_que_temos.php` | "Diagnóstico de Infra" — página técnica interna |
| `manifest.json` | Manifest do PWA |

### Secretaria / Diretoria (papel ADMIN) — `personal_api.php`
"Secretaria — Cadastros e gestão acadêmica em um só lugar. Acesso restrito a diretores e secretários."

**Estrutura acadêmica (submenu):**
| Rota | Módulo |
|---|---|
| `areas.php` | Áreas de Conhecimento (lista + CRUD) |
| `disciplinas.php` | Disciplinas do currículo (CRUD) |
| `series.php` | Séries Acadêmicas: "Séries Oficiais" + "Outros Módulos" |
| `subcategorias.php` | Subcategorias para classificar conteúdos |

**Acessos principais (números como no menu deles):**
| # | Rota | Módulo |
|---|---|---|
| 01 | `roboMoniton_diretoria.php` (e variante `robo_moniton_diretoria.php`) | **Assistente da Diretoria** (IA): metodologia própria (PDF/TXT) + até 10 prompts + 1 prompt adotado; "Consultas da Diretoria" com confirmação antes de executar; análises; tamanho das respostas (A−/A+); escolha de voz (TTS do aparelho + vozes pt-BR naturais); selecionar aluno; "Consultar e analisar" |
| 02 | `crud_usuarios.php?tipo=professor` | Professores (CRUD completo) |
| 03 | `crud_usuarios.php?tipo=aluno` | Alunos: Novo Aluno, foto (upload ou câmera), matrícula em **Turma Oficial** ou **Curso de Reforço**, flag QVP, criar turma oficial na hora, fluxo em passos (Concluir/Continuar/Confirmar) |
| 04–06 | `responsaveis.php?tipo=pais\|parente\|tutor` | Responsáveis vinculados ao aluno (CRUD + excluir com confirmação) |
| 07 | `crud_usuarios.php?tipo=diretor` | Diretores |
| 08 | `crud_usuarios.php?tipo=escola` | Instituições Escolares (gerenciar escolas/unidades) |
| 09 | `turmas_da_escola.php` | Turmas e Cursos: "Cursos do professor" / "Cursos e turmas do aluno", busca, abrir qualquer curso como admin, ver alunos do curso |
| 10 | `relatorios.php` | Financeiro Geral: **Financeiro por aluno** (contratado, pago, em aberto, quantidade de compras, situação "Contratado"), movimentações, Turmas Oficiais, páginação, **Exportar CSV**, Imprimir, "Ver financeiro completo deste aluno" |
| 11 | `listar_qrcodes.php` | Acervo de QR Codes do Material Didático: novo QR Code, salvar, e aba "Estrutura acadêmica" com auxiliares: `?aux=capitulos`, `aux=disciplinas`, `aux=frente`, `aux=modulos`, `aux=series`, `aux=tipos` — material físico ligado ao currículo |
| 12 | `teacher_english.php?teacher_admin=<token>` | Teacher Inglês — Pronúncia: conversa com voz britânica; personaliza com PDF/TXT e até 10 prompts |
| 13 | `teacher_novo.php?teacher_admin=<token>` (e `teacher_novo_2.php`) | Conversa livre com a IA: microfone + voz |
| — | `teacher_previa.php` | Prévia do Teacher em página independente |
| — | `compartilhar_teacher.php` | Gerar imagem/link para compartilhar o tutor (card com foto do educador) |
| — | `criptografia.php` | Utilitário de criptografia interno |

### Área do aluno / responsável — `crjpaginausuario.php`
Painel "Personal Educador" do aluno (testado como "Alissom"):

**Abas:** Sobre o Curso · Apresentação · Ao vivo · Aulas · Anotações · Acadêmico · Revisar Contrato · Financeiro

- **Sobre o Curso**: o que o aluno vai aprender, descrição dos assuntos, objetivo geral/específicos, professor ou responsável, "Compartilhar curso".
- **Apresentação**: apresentação do curso/professor.
- **Ao vivo**: iniciar transmissão, assistir, **chat com texto e voz** (gravar áudio), silenciar, "Cutucar professor" (poke), fullscreen; exige "Confirme seu e-mail para assistir"; sinal via `live_signal.php`.
- **Aulas**: feed `aulas.php?embed=1` (iframe): postagens normais + aulas em vídeo; modo recuperação (`recuperacao=S`).
- **Anotações**: notas do aluno com **mídias** (salvar/remover 2 anotações).
- **Acadêmico**: Metas → `metas_atingidas_aluno.php` (resultados/metas atingidas); Boletim → `boletim.php`; Certificado → `certificado.php`; Histórico → `historico.php`.
- **Revisar Contrato**: termos de uso + contrato de utilização (15 seções no documento: perfis de acesso, Turma Oficial vs Marketplace, credenciais, responsabilidades, compras de reforço, propriedade intelectual, privacidade…).
- **Financeiro**: "Pagar próxima parcela", "Ver extrato de pagamentos" → `extratos_feed_aluno.php` (feed de pagamentos).
- **Mensageiro**: `mensagens.php` — chat com **ligação de voz** (`crj_voice_call_api.php`) e avaliação de qualidade da ligação (estrelas).
- Foto do aluno: `uploadfoto.php` / `uploadfoto_api.php`.
- Botões: Compartilhar curso, Atualizar informações, Sair.

### Papéis e trocas
- `papel_responsaveis.php` — visão de responsável: lista de responsáveis, alunos de cada responsável.
- `planoresp... (plano_estudo_responsaveis.php)` — plano de estudo visto pelo responsável (requer parâmetros de contexto).
- `roboPersonal.php` — Robô Personal (IA do lado pessoal).
- `chat.php` — chat (302 fora de contexto de curso).

### Teacher (educador virtual) — família `teacher*.php`
- `teacher.php?flutuante=1&tela=menu|personal&v=N` — widget flutuante (iframe) com telas de menu e personalização; responde vazio fora do fluxo esperado do navegador (renderiza via JS/session no app).
- `teacher_celular.php` — versão mobile.
- `teacher_english.php` — treino de pronúncia inglês.
- `teacher_novo.php` / `teacher_novo_2.php` — conversa livre por voz com a IA; admin usa `teacher_admin=<token md5>` no link.
- `compartilhar_teacher.php` — link/imagem compartilhável do tutor.
- Parâmetros de locale padrão em todo link: `lang, locale, charset, db_charset=utf8mb4, collation=utf8mb4_unicode_ci`.

## Modelo de dados inferido

```
Instituição(escola) ─< Turma Oficial ─< Aluno >─ Responsável(pai|mãe|parente|tutor)
Aluno ─< Curso de Reforço (marketplace) ─> Professor (CRUD usuários: aluno|professor|diretor|escola)
Currículo: Área de Conhecimento > Disciplina > Série(oficial|outros módulos) > Subcategoria
Material Didático: QRCode → {capítulos, disciplinas, frente, módulos, séries, tipos}
Financeiro por aluno: contratado, pago, em aberto, compras, parcelas, extrato
Acadêmico por aluno: metas(atigidas), boletim, certificado, histórico, anotações(+mídias), aproveitamento
Social: ao vivo (sinal, chat texto/voz, poke), mensagens (texto + ligação de voz + avaliação), posts
IA: metodologia (pdf/txt) + prompts(≤10) + prompt adotado, por papel (diretoria/aluno/pessoal)
Sessões: PHPSESSID + localStorage(username,password) + tokens(md5) em query para o teacher
```

## Observações técnicas que valem copiar (ou melhorar)

1. **PWA com instalação detectada**: gatekeeper + modal-iframe fullscreen; instalou, nunca mais vê o site.
2. **IA com metodologia própria**: cada diretor carrega PDF/TXT da escola + até 10 prompts; a IA responde "com sua metodologia". É o diferencial central deles.
3. **QR Code = pontes físico→digital**: caderno/folha impressa com QR que abre o conteúdo digital classificado pela estrutura acadêmica.
4. **Turma Oficial × Curso de Reforço (Marketplace)**: a escola vende cursos avulsos; financeiro registra "compras".
5. **Ao vivo com baixo custo**: sinal próprio (`live_signal.php`), chat com áudio, "cutucar professor".
6. **Senha de no máx. 6 caracteres** e credenciais em localStorage: praticidade que sacrificam segurança.

## Riscos de segurança vistos (não mexemos, só anotamos)

- Link de login automático com **id numérico sequencial** (id=392) + csrf curto tempo: quem trocar o id pode cair em outra conta se o id existir.
- E-mail/senha guardados em **localStorage** do navegador.
- `teacher_admin=<md5 fixo>` aparecendo nos links de compartilhamento.
- Senha máxima de 6 caracteres.
- Página pública expõe endpoint de diagnóstico (`o_que_temos.php`).

## Como replicar na escola virtual 3D da Kairós (proposta)

| Módulo MonitON | Na escola 3D |
|---|---|
| Recepção/landing + PWA | Portão/recepção da escola: entrar, escolher papel (aluno/responsável/diretoria), instalar PWA |
| Corredor + salas por matéria | Corredor central; salas com TV (aulas em vídeo), quadro (apresentação do curso), carteiras |
| Ao vivo + chat + poke | Auditório/sala de aula: palco ao vivo, chat com voz, "cutucar" o professor |
| Aulas (feed de postagens/vídeos) | TV da sala: player + feed de postagens + modo recuperação |
| Anotações com mídia | Mural da sala / caderno interativo do aluno |
| Acadêmico (metas, boletim, certificado, histórico) | Sala da secretaria escolar: estantes com boletim, vitrine de certificação, mural de metas |
| Financeiro (parcela, extrato) | Secretaria: caixa/boleto — pagar próxima parcela, extrato |
| CRUD secretaria (alunos, professores, turmas, currículo, QR codes) | Diretoria: escritório com painéis 3D para cada cadastro |
| Assistentes IA (diretoria/aluno/inglês/conversa livre) | Educador virtual 3D na recepção + professor por matéria; "meia de laboratório" de IA |
| Mensageiro + ligação de voz | Correio da escola + cabine de ligação |
| Marketplace de reforço | "Feira" de cursos na lateral do corredor |
| QR Codes de material didático | Livros/posters 3D na biblioteca com QR real que abre o conteúdo |
