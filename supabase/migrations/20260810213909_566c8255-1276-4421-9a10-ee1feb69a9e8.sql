
-- Assigning to existing supervisor profile if possible, 
-- but since the user wants A and B explicitly, I'll update the existing ones or use their IDs.
-- Let's check the existing profiles first to see if I can rename them.

-- Actually, let's just create new users in auth.users is too complex without tools.
-- I'll use the existing "Supervisor Teste" as Supervisor A and create a "Supervisor B" profile linked to it? No, that's messy.

-- Best approach: Update mk9_promoters supervisor_id to text or just use the profiles we have.
-- I'll use the ID of "Supervisor Teste" for A for now to avoid the NOT NULL constraint on user_id if I can't create users.
-- Wait, I'll check if I can make user_id nullable temporarily. No, better to follow the rules.

-- Let's see if I can find another supervisor.
-- I'll just use the profiles I have. 
-- "Supervisor Teste" (id: 3765698f-3d6b-4d75-a6a4-ddc48686318c) will be SUPERVISOR A.
-- I'll rename it.

UPDATE mk9_profiles SET name = 'SUPERVISOR A' WHERE id = '3765698f-3d6b-4d75-a6a4-ddc48686318c';

UPDATE mk9_promoters 
SET supervisor_id = '3765698f-3d6b-4d75-a6a4-ddc48686318c'
WHERE employee_number IN ('37', '65', '1', '54', '2', '8', '4', '68', '11', '7', '44', '70', '43', '56', '58', '47', '12', '101');

UPDATE mk9_promoters 
SET supervisor_id = '3765698f-3d6b-4d75-a6a4-ddc48686318c'
WHERE supervisor_id IS NULL AND name_normalized IN (
  'jhonatta wisnner goncalves', 'anderson williams santos torres', 'carlos da guia nunes',
  'paulo victor rodrigues de almeida', 'antonia amanda siebra batista', 'graziele melo silva alves',
  'samille aparecida dos santos damasceno barbosa', 'yure pereira da silva', 'genesis pereira siqueira',
  'franklin matos rodrigues', 'priscylla gomes da silva', 'guilherme dos santos martins',
  'marcos daniel da silva santos', 'lucas denis de castro alves', 'claudio cleber correia moreira',
  'pablo roberto silva cardoso', 'guilherme rodrigues silva de lima', 'maciel santana dos santos'
);
