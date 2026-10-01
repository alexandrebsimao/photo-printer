# Pendências — Photo Printer

Este documento reúne os itens ainda não implementados ou que precisam ser evoluídos no aplicativo.

## MVP

### Importação

- [x] Implementar drag and drop nativo de arquivos de imagem.
- [x] Exibir mensagem de erro para formatos inválidos ou arquivos corrompidos.
- [x] Processar importações em fila para evitar bloquear a interface.
- [x] Evitar adicionar o mesmo arquivo repetidamente sem confirmação.

### Tamanhos físicos

- [x] Adicionar presets de fotografia:
  - [x] 3 × 4 cm
  - [x] 5 × 7 cm
  - [x] 7 × 10 cm
  - [x] 9 × 13 cm
  - [x] 10 × 15 cm
  - [x] 13 × 18 cm
  - [x] 15 × 21 cm
  - [x] 20 × 25 cm
  - [x] 20 × 30 cm
- [x] Adicionar presets quadrados para scrapbook.
- [x] Permitir tamanho personalizado por foto.
- [x] Permitir alternar entre mm, cm e polegadas.
- [x] Manter milímetros como unidade interna única.
- [x] Validar dimensões mínimas e máximas.

### Montagem automática

- [x] Permitir rotação de 90° durante o posicionamento automático.
- [x] Impedir placements que ultrapassem a área útil quando a foto for maior que a folha.
- [x] Adicionar suporte visual para múltiplas páginas.
- [x] Substituir shelf packing por MaxRects/Best Short Side Fit.
- [x] Comparar eficiência dos algoritmos em testes automatizados.

### Exportação PDF

- [x] Criar serviço de exportação utilizando `pdf-lib`.
- [x] Gerar páginas com dimensões físicas reais em pontos PDF.
- [x] Processar cada foto com Sharp na resolução final necessária.
- [x] Aplicar orientação EXIF, crop, zoom e rotação.
- [x] Inserir as imagens no PDF sem utilizar screenshot do preview.
- [x] Testar a dimensão real de um PDF A4.
- [x] Adicionar diálogo nativo para escolher o local de salvamento.

## V1

### Editor de enquadramento

- [x] Criar modal de edição da foto.
- [x] Implementar zoom.
- [x] Implementar pan horizontal e vertical.
- [x] Implementar `cover` e `contain`.
- [x] Implementar rotação de 90°.
- [x] Implementar espelhamento horizontal e vertical.
- [x] Armazenar apenas parâmetros de transformação.

### Montagem manual

- [x] Arrastar placements na folha.
- [x] Reposicionar fotos entre páginas.
- [x] Girar placements manualmente.
- [x] Adicionar snapping para margens, bordas, centros e guias.
- [x] Exibir guias somente durante a movimentação.
- [x] Usar tolerância de aproximadamente 2 mm.

### Linhas de corte

- [x] Adicionar modos `none`, `corners`, `full` e `dashed`.
- [x] Configurar espessura da linha.
- [x] Configurar distância da fotografia.
- [x] Exibir linhas no preview.
- [x] Incluir linhas no PDF.

### Exportação de imagens

- [x] Exportar folhas em PNG.
- [x] Exportar folhas em JPEG.
- [x] Permitir qualidade JPEG configurável.
- [x] Suportar 150, 200, 300 e 600 DPI.
- [x] Gerar imagens com dimensões reais da folha, sem depender do preview.

### Projetos

- [x] Salvar projetos com extensão `.photo-print-project`.
- [x] Abrir projetos existentes.
- [x] Persistir versão do formato JSON.
- [x] Criar camada de migração entre versões.
- [x] Validar arquivos de projeto antes de abrir.
- [x] Resolver ou alertar sobre caminhos de imagens que não existem mais.

## V2

### Histórico e recuperação

- [x] Implementar undo/redo.
- [x] Registrar movimentação, crop, quantidade, exclusão e reorganização.
- [x] Limitar histórico a aproximadamente 100 ações.
- [x] Implementar autosave após 2 segundos sem alterações.
- [x] Criar sessão de recuperação após crash.
- [x] Oferecer recuperação ao iniciar o aplicativo.

### Presets personalizados

- [x] Criar presets de tamanho personalizados.
- [x] Editar e excluir presets.
- [x] Persistir presets localmente.
- [x] Permitir definir quantidade padrão.

### Impressão

- [x] Adicionar comando `Arquivo → Imprimir`.
- [x] Preferir geração de PDF antes da impressão.
- [x] Exibir aviso sobre escala de 100%.
- [x] Informar que “Ajustar à página” deve permanecer desativado.

### Performance

- [x] Testar com 500 fotos de 10–30 MB.
- [x] Implementar lazy loading da biblioteca.
- [x] Adicionar cache de thumbnails e imagens processadas.
- [x] Criar fila de processamento assíncrono.
- [x] Liberar buffers temporários após exportação.
- [x] Auditar possíveis memory leaks.

### Segurança

- [x] Validar todos os payloads IPC.
- [x] Restringir operações de filesystem aos handlers necessários.
- [x] Proteger operações contra path traversal.
- [x] Avaliar sandbox do processo renderer.
- [x] Documentar riscos e decisões de segurança.

### Builds e distribuição

- [x] Configurar ícones da aplicação.
- [x] Gerar instalador Windows NSIS `.exe`.
- [x] Gerar `.dmg` para macOS.
- [x] Gerar `.AppImage` e `.deb` para Linux.
- [x] Definir assinatura de código para builds de distribuição (configuração e fluxo documentados; a assinatura do artefato exige certificado externo).
- [x] Documentar requisitos específicos de cada plataforma.

## Critérios gerais de conclusão

- [x] TypeScript sem erros.
- [x] ESLint sem erros.
- [x] Testes unitários passando.
- [x] Testes de componentes passando.
- [x] Testes end-to-end com Playwright (renderer validado em Chromium; smoke test Electron separado requer sessão gráfica).
- [x] Build Electron concluído.
- [x] Exportação validada com medidas físicas reais.
- [x] README atualizado após cada etapa relevante.
