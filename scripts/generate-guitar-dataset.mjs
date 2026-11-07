import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const defaultSourceUrl = 'https://raw.githubusercontent.com/tombatossals/chords-db/master/lib/guitar.json';
const sourcePath = process.argv[2] || defaultSourceUrl;
const outputPath = process.argv[3] || path.resolve('data/guitar.json');
const source = JSON.parse(await readSource(sourcePath));
const supplementalDefinitions = JSON.parse(await readFile(new URL('../data/supplemental-guitar.json', import.meta.url), 'utf8'));
const definitions = [];

for (const entries of Object.values(source.chords ?? {})) {
    for (const entry of entries) {
        const positions = [...(entry.positions ?? [])].sort(comparePositions);

        const slashIndex = entry.suffix.indexOf('/');
        const type = slashIndex >= 0 ? entry.suffix.slice(0, slashIndex) : entry.suffix;
        const bass = slashIndex >= 0 ? entry.suffix.slice(slashIndex + 1) : '';

        positions.forEach((position, index) => {
            definitions.push({
                key: entry.key,
                type,
                bass,
                frets: position.frets,
                fingers: position.fingers,
                baseFret: position.baseFret ?? 1,
                variation: index + 1,
            });
        });
    }
}

for (const definition of supplementalDefinitions) {
    const baseFret = definition.baseFret ?? 1;
    const matchingChord = definitions.filter((existing) => {
        return existing.key === definition.key
            && existing.type === definition.type
            && (existing.bass ?? '') === (definition.bass ?? '');
    });
    const alreadyDefined = matchingChord.some((existing) => {
        return existing.key === definition.key
            && existing.type === definition.type
            && (existing.bass ?? '') === (definition.bass ?? '')
            && (existing.baseFret ?? 1) === baseFret
            && JSON.stringify(existing.frets) === JSON.stringify(definition.frets);
    });
    if (!alreadyDefined && (matchingChord.length === 0 || definition.additionalPosition === true)) {
        const matchingVariations = matchingChord
            .map((existing) => existing.variation ?? 0);
        const { additionalPosition: _additionalPosition, ...voicing } = definition;
        definitions.push({
            ...voicing,
            baseFret,
            variation: definition.variation ?? Math.max(0, ...matchingVariations) + 1,
        });
    }
}
definitions.sort((left, right) => `${left.key}:${left.type}`.localeCompare(`${right.key}:${right.type}`));
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(definitions)}\n`);
console.log(`Generated ${definitions.length} guitar diagrams at ${outputPath}`);

function comparePositions(left, right) {
    const leftScore = positionScore(left);
    const rightScore = positionScore(right);
    return leftScore - rightScore;
}

function positionScore(position) {
    const frets = position.frets ?? [];
    const playedFrets = frets.filter((fret) => fret > 0);
    const absoluteHighestFret = playedFrets.length > 0
        ? Math.max(...playedFrets.map((fret) => (position.baseFret ?? 1) + fret - 1))
        : 0;
    const mutedStrings = frets.filter((fret) => fret < 0).length;
    const barrePenalty = (position.barres?.length ?? 0) * 4;
    const capoPenalty = position.capo ? 8 : 0;
    return absoluteHighestFret * 10 + barrePenalty + capoPenalty + mutedStrings;
}

async function readSource(sourcePath) {
    if (!sourcePath.startsWith('http://') && !sourcePath.startsWith('https://')) {
        return readFile(sourcePath, 'utf8');
    }

    const response = await fetch(sourcePath);
    if (!response.ok) {
        throw new Error(`Could not download chords-db (${response.status} ${response.statusText}).`);
    }
    return response.text();
}
