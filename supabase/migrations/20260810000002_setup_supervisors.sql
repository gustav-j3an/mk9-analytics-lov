-- 1. Garante que os perfis virtuais dos supervisores existam em mk9_profiles
-- Usamos UUIDs fixos para Supervisor A e B para facilitar a migração
-- Nota: Em um sistema real, estes seriam usuários auth.users, mas aqui 
-- representam grupos lógicos permanentes vinculados a mk9_profiles.

INSERT INTO mk9_profiles (id, name, email, active)
VALUES 
  ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a1', 'SUPERVISOR A', 'supervisor.a@mk9trade.com', true),
  ('b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b2', 'SUPERVISOR B', 'supervisor.b@mk9trade.com', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 2. Atualizar promotores da lista do Supervisor A
-- Lista: 37, 65, 1, 54, 2, 8, 4, 68, 11, 7, 44, 70, 43, 56, 58, 47, 12, 101

UPDATE mk9_promoters 
SET supervisor_id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a1'
WHERE employee_number IN ('37', '65', '1', '54', '2', '8', '4', '68', '11', '7', '44', '70', '43', '56', '58', '47', '12', '101');

-- Para os que não tem matrícula, tentamos pelo nome normalizado (fallback de segurança)
UPDATE mk9_promoters 
SET supervisor_id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a1'
WHERE supervisor_id IS NULL AND name_normalized IN (
  'jhonatta wisnner goncalves', 'anderson williams santos torres', 'carlos da guia nunes',
  'paulo victor rodrigues de almeida', 'antonia amanda siebra batista', 'graziele melo silva alves',
  'samille aparecida dos santos damasceno barbosa', 'yure pereira da silva', 'genesis pereira siqueira',
  'franklin matos rodrigues', 'priscylla gomes da silva', 'guilherme dos santos martins',
  'marcos daniel da silva santos', 'lucas denis de castro alves', 'claudio cleber correia moreira',
  'pablo roberto silva cardoso', 'guilherme rodrigues silva de lima', 'maciel santana dos santos'
);

-- 3. Supervisor B = Ativos restantes (que não são do A)
-- Esta é uma regra de negócio que será aplicada na query de leitura,
-- mas podemos deixar o supervisor_id como NULL para representar o B por padrão 
-- conforme solicitado ("B = ativos restantes").

