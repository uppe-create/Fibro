# Inventario minimo - tratamento de dados CIPF

| Atividade | Dados | Finalidade | Base operacional | Operadores/apoio |
| --- | --- | --- | --- | --- |
| Cadastro | nome, CPF, RG, nascimento, endereco, contato | abrir solicitacao | politica publica / atribuicao legal | Supabase |
| Analise documental | documento, comprovante, laudo, foto, CID, CRM | validar pedido | politica publica / tutela da saude | Supabase |
| Emissao e renovacao | identificacao, status, datas | gerar carteirinha valida | politica publica | Supabase |
| Validacao publica | nome, CPF mascarado, datas, status | confirmar autenticidade | interesse publico com exposicao minima | Supabase |
| Auditoria | usuario, IP, horario, acao, motivo | seguranca e rastreabilidade | controle interno | Supabase |
| Consulta CEP | CEP | preenchimento assistido | apoio operacional | ViaCEP |
| Contato por WhatsApp | telefone, mensagem operacional | aviso ao titular | ato operacional da equipe | WhatsApp Web |

## Pendencias
- Completar classificacao formal de controlador, operador e encarregado.
- Confirmar todos os fornecedores e contratos vigentes.
- Associar prazos de retencao por conjunto de dados.
