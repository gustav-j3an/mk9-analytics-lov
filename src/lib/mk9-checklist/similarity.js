// Similaridade de strings via coeficiente de Dice sobre bigramas de caracteres.
// Portável, sem dependências, adequado para comparar nomes de lojas normalizados.
function bigrams(input) {
    const map = new Map();
    const s = ` ${input} `;
    for (let i = 0; i < s.length - 1; i++) {
        const g = s.slice(i, i + 2);
        map.set(g, (map.get(g) ?? 0) + 1);
    }
    return map;
}
export function diceCoefficient(a, b) {
    if (!a || !b)
        return 0;
    if (a === b)
        return 1;
    const A = bigrams(a);
    const B = bigrams(b);
    let intersection = 0;
    let totalA = 0;
    let totalB = 0;
    for (const v of A.values())
        totalA += v;
    for (const v of B.values())
        totalB += v;
    for (const [g, count] of A) {
        const other = B.get(g);
        if (other)
            intersection += Math.min(count, other);
    }
    return (2 * intersection) / (totalA + totalB);
}
