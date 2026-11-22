# 0001 — Sem RustDesk Server Pro

- **Status:** decidido, permanente
- **Data:** 2026-11-22
- **Decisor:** dono da NextCore

## Decisão

A NextCore **nunca** vai contratar o RustDesk Server Pro. Ela desenvolve a própria solução de
acesso remoto e já roda o **NCDesk**, seu servidor RustDesk próprio (hbbs/hbbr de código
aberto, self-hosted).

## Consequências

- Nenhuma funcionalidade do RDGEN, do fork `nextcoreti/rustdesk` ou do NextCore RMM pode
  depender de recurso exclusivo do Pro.
- Ficam fora: cliente web oficial, Strategies, console/API do Pro, escolha de relay por
  latência/geografia.
- **Política e configuração dos clientes:** opções de build do RDGEN + NextCore RMM
  (`rustdesk --config`, scripts de execução remota).
- **Acesso pelo navegador:** não o cliente web oficial. Caminhos possíveis:
  - MeshCentral (código aberto, Apache-2.0) integrado ao NextCore RMM;
  - desenvolvimento próprio sobre o agente do RMM.
  - O cliente web do `lejianwen/rustdesk-api` não é recomendado: é um pacote compilado vindo
    de imagem Docker de terceiro, sem código auditável.
- **Vários relays:** o hbbs aberto (`--relay-servers`) divide a carga entre eles, mas não
  escolhe por latência. Escolha por latência seria desenvolvimento próprio.

## Para quem contribui

Ao propor uma solução, não listar o Pro como opção, plano B ou atalho.
