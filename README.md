# Photo Printer

Aplicativo desktop multiplataforma para preparar fotos para impressão em medidas físicas reais.

## Estado atual

O projeto contém o núcleo do MVP: importação por diálogo e drag-and-drop, thumbnails Sharp, presets físicos, shelf/MaxRects, múltiplas páginas, editor de enquadramento, montagem manual, linhas de corte, PDF/PNG/JPEG, projetos JSON, undo/redo, autosave e impressão via PDF.

### Fluxo de montagem

1. Importe as imagens pela biblioteca à esquerda. A importação apenas adiciona os arquivos à biblioteca.
2. Clique em `Inserir na página` no cartão de cada foto para posicioná-la na página atual. Repita o clique para inserir a mesma foto mais de uma vez.
3. Use `+ Nova página` para criar uma página vazia e navegue pelas páginas com as setas.
4. Use `Organizar automaticamente` quando quiser distribuir as cópias pela quantidade mínima de folhas. Essa é uma ação explícita e não é executada ao importar, alterar tamanho ou configurar a folha.

As páginas vazias e os posicionamentos manuais são incluídos no projeto salvo e na sessão de recuperação.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior

## Desenvolvimento

```bash
npm install
npm run dev
```

## Verificação

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run test:e2e:electron
npm run build
```

`npm run test:e2e` valida o renderer em Chromium através do build de produção. `npm run test:e2e:electron` executa o smoke test real do Electron e requer uma sessão gráfica com suporte a `BrowserWindow`.

O DMG macOS foi validado neste ambiente. A assinatura de código permanece dependente de um certificado Developer ID configurado no sistema; sem ele o electron-builder gera um artefato unsigned.

Para uma build assinada, configure `CSC_NAME` com o nome ou fingerprint do certificado Developer ID Application e execute `npm run package:mac:signed`. Em CI, forneça também `CSC_LINK` e `CSC_KEY_PASSWORD` quando o certificado vier de um arquivo seguro. O arquivo `build/entitlements.mac.plist` já está configurado.

## Empacotamento

```bash
npm run package          # plataforma atual
npm run package:mac     # DMG
npm run package:win     # NSIS EXE
npm run package:linux   # AppImage e DEB
```

O renderer não possui acesso direto ao filesystem ou ao Node.js. Operações privilegiadas devem ser adicionadas como handlers IPC e expostas somente por `contextBridge` no preload.

## Distribuição

O ícone da aplicação fica em `build/icon.svg` e sua versão PNG é usada pelo electron-builder. Os targets configurados são DMG para macOS, NSIS para Windows e AppImage/DEB para Linux.
