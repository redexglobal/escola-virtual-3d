# Escola Virtual 3D

Ambiente escolar imersivo navegável em 3D: corredor, salas por disciplina, educador virtual e um conjunto completo de ferramentas de escola (minha área do aluno, secretaria, ao vivo, mensageiro, feira de reforço e biblioteca de QR codes), inspirado na estrutura de plataformas de gestão escolar.

**Demo no ar:** <https://redexglobal.github.io/escola-virtual-3d/>

![Escola Virtual 3D — recepção](docs/capturas/sh_01_recepcao.png)

## Como funciona

Você anda pela escola com **WASD/setas + mouse** no computador e com o **controle redondo na tela** no celular. No menu superior dá para ir direto a qualquer sala pelo mapa ou pelos botões.

### O 3D

- Recepção, corredor e **6 salas**: Matemática, Português, Ciências, História, Geografia e Inglês.
- Cada sala tem quadro-negro, carteiras, TV (aula em vídeo) e o **educador virtual**, que acena uma vez quando você entra, fica parado em seguida e fala a saudação com a voz do aparelho.
- O botão “Falar com o educador” abre uma conversa local com a IA (regras em português + voz) e sabe qual matéria você está vendo. Se houver um tutor externo configurado (`tutorUrl` em `conteudo.js`), o botão passa a abrir ele já com a disciplina.
- TV da sala toca `videos/<matéria>.mp4` se existir; sem arquivo, mostra “vídeo ainda não enviado” (nada é inventado).
- Roda offline depois do primeiro carregamento (PWA) e em dispositivos móveis.

### Os módulos da plataforma (menu “Escola ▾”)

| Módulo | O que faz |
|---|---|
| **Minha área** | Boletim por matéria, metas, certificado (imprimível), histórico e financeiro com extrato — como kioskê do aluno |
| **Secretaria** | Cadastro de alunos, professores, responsáveis, currículo (área > disciplina > série > subcategoria), turmas oficiais e cursos de reforço, financeiro geral, QR codes e assistente IA (metodologia + prompts) |
| **Ao vivo** | Sala com “no ar”, chat e microfone (áudio gravado em até 15 s) |
| **Mensageiro** | Conversas com secretaria/educador/família, áudio e **ligação de voz** com avaliação de qualidade |
| **Feira** | Vitrine de cursos de reforço: compra gera matrícula, compra, extrato e aviso no chat da sala |
| **Biblioteca QR** | Gera QR codes de material; cada QR abre a sala certa na escola |

### Onde ficam os dados

Todos os dados ficam **no próprio navegador** (IndexedDB), prontos para trocar depois por um backend PHP sem refazer o 3D: toda leitura e escrita passa por uma única camada (`dados.js`) que envia eventos a cada mudança. Não há login obrigatório: cada dispositivo guarda o perfil dele. Para demonstrar, basta abrir o link e tocar em “Entrar”.

## Estrutura

```
index.html          entrada, telas e painéis
app.js              motor 3D (Three.js): planta, salas, personagem, mapa
conteudo.js         nome da escola, aulas, exercícios, saudações, créditos
dados.js            camada de dados (IndexedDB + seeds)
telas.js            painel 2D: abas, tabelas, formulários, modais, QR
modulo-aluno.js     minha área (boletim, metas, certificado, financeiro…)
modulo-secretaria.js  secretaria completa (CRUDs, financeiro, QR, IA)
modulo-escola.js    ao vivo, mensageiro, feira, biblioteca QR, chat com IA
vendor/             three.js local (sem CDN)
videos/             coloque aqui os vídeos das aulas (<matéria>.mp4)
testes/             testes automatizados (Playwright)
docs/               mapas da pesquisa de referência e capturas
```

## Rodar localmente

```bash
cd escola-virtual-3d
python3 -m http.server 8811
# abra http://localhost:8811
```

Testes (precisam do Playwright instalado):

```bash
node testes/teste-pagina.mjs   # tour completo: minha área, secretaria, ao vivo, feira, educador
node testes/teste-mobile.mjs   # iPhone simulado: entrada, secretaria, QR
```

## Dependências

Nenhuma: Three.js vem embutido em `vendor/`, sem CDN e sem etapa de build. Os vídeos das aulas são opcionais.

---

Desenvolvido por **Vilson Mota · Kairós Digital** — <https://www.instagram.com/_kairosdigital_/> · WhatsApp: <https://wa.me/5562984924326>
