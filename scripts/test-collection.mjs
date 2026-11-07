import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { Chord, ChordDiagram, ChordDiagramCollection, Instrument, SvgBuilder } from '../dist/index.js';

const dom = new JSDOM();
globalThis.document = dom.window.document;

const definitions = JSON.parse(await readFile(new URL('../data/guitar.json', import.meta.url), 'utf8'));
const collection = new ChordDiagramCollection(definitions);

const duplicatePositionCollection = new ChordDiagramCollection([
	{ key: 'G', type: 'sus4', frets: [3, 3, 1, 1, 1, 3], variation: 1 },
	{ key: 'G', type: 'sus4', frets: [3, 3, 1, 1, 1, 3], variation: 2 },
	{ key: 'G', type: 'sus4', frets: [8, 8, 6, 6, 6, 8], variation: 3 },
]);
assert.equal(duplicatePositionCollection.get(new Chord('G', 'sus4')).length, 2);

assert.equal(collection.get(new Chord('C', 'M')).length > 0, true);
assert.equal(collection.get(new Chord('A', 'm')).length > 0, true);
assert.equal(collection.get(new Chord('A', 'm', 'E')).length > 0, true);
assert.equal(collection.get(new Chord('C', '', 'G')).length > 0, true);
assert.equal(collection.get(new Chord('D', '', 'F#')).length > 0, true);
const cSharpSeventhPositions = collection.get(new Chord('C#', '7'));
assert.equal(cSharpSeventhPositions.length, 5);
assert.deepEqual(cSharpSeventhPositions[4].frets, [-1, 4, 3, 4, 0, 4]);
assert.deepEqual(cSharpSeventhPositions[4].fingers, [0, 2, 1, 3, 0, 4]);

const builder = new SvgBuilder();
const testChord = new ChordDiagram({ frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], baseFret: 1 });
const guitar = new Instrument('Guitar', 6, 4, ['E', 'A', 'D', 'G', 'B', 'E']);
const cSharpSeventhDiagram = builder.build(cSharpSeventhPositions[4], guitar, ['C#', 'E#', 'G#', 'B']);
assert.deepEqual([...cSharpSeventhDiagram.querySelector('.neck').querySelectorAll('text')].map((label) => label.textContent), ['x', 'C♯', 'E♯', 'B', 'B', 'G♯']);

builder.settings.neck.nut.visible = false;
builder.settings.neck.stringInfo.visible = false;
builder.settings.fingering.margin = 0;
const svg = builder.build(testChord, guitar);
const staffSvg = builder.buildStaff(testChord, guitar);
const fSharpMinorSeventhStaff = builder.buildStaff(new ChordDiagram({ frets: [2, -1, 2, 2, 2, -1], baseFret: 1 }), guitar, ['F#', 'A', 'C#', 'E']);
const gSharpMinorSixthStaff = builder.buildStaff(new ChordDiagram(), guitar, ['G#', 'B', 'D#', 'E#']);
const eSharpNinthStaff = builder.buildStaff(new ChordDiagram(), guitar, ['E', 'G#', 'B', 'D', 'F##']);
const gSharpMinorSixthDiagram = builder.build(new ChordDiagram({ frets: [1, -1, -1, -1, -1, -1], baseFret: 1 }), guitar, ['G#', 'B', 'D#', 'E#']);
const eSharpNinthDiagram = builder.build(new ChordDiagram({ frets: [3, -1, -1, -1, -1, -1], baseFret: 1 }), guitar, ['E', 'G#', 'B', 'D', 'F##']);
const stackedAccidentalsStaff = builder.buildStaff(new ChordDiagram(), guitar, ['E#', 'G#', 'B#']);
const cThirteenthStaff = builder.buildStaff(new ChordDiagram(), guitar, ['C', 'E', 'G', 'Bb', 'D', 'F', 'A']);
const cMajorStaff = builder.buildStaff(new ChordDiagram(), guitar, ['C', 'E', 'G']);
const aFlatMajorStaff = builder.buildStaff(new ChordDiagram(), guitar, ['Ab', 'C', 'Eb']);
const bFlatStaff = builder.buildStaff(new ChordDiagram(), guitar, ['Bb']);
const bDoubleFlatStaff = builder.buildStaff(new ChordDiagram(), guitar, ['Bbb']);
assert.equal(svg.querySelectorAll('path').length, 7);
assert.equal(staffSvg.getAttribute('viewBox'), '-8 -12 50 30');
assert.equal(svg.querySelectorAll('circle').length, 3);
assert.equal(staffSvg.querySelector('g').querySelectorAll('line').length, 6);
assert.equal(staffSvg.querySelector('g').querySelectorAll('ellipse').length, 3);
assert.equal(staffSvg.querySelector('g').querySelectorAll('.chord-staff-label').length, 3);
assert.equal(staffSvg.querySelectorAll('.chord-staff-clef').length, 1);
assert.equal(staffSvg.textContent?.includes('𝄞'), false);
assert.equal(staffSvg.querySelector('.chord-staff-clef').getAttribute('fill'), 'var(--staff-clef-color, currentColor)');
assert.equal(staffSvg.querySelector('g').getAttribute('transform'), 'translate(0, 3)');
assert.ok(Math.abs(Math.abs(Number(fSharpMinorSeventhStaff.querySelectorAll('ellipse')[0].getAttribute('cx')) - Number(fSharpMinorSeventhStaff.querySelectorAll('ellipse')[1].getAttribute('cx'))) - 3.4) < 0.001);
assert.deepEqual([...fSharpMinorSeventhStaff.querySelectorAll('ellipse')].map((notehead) => notehead.getAttribute('cx')), ['28.7', '25.3', '25.3', '25.3']);
assert.deepEqual([...fSharpMinorSeventhStaff.querySelectorAll('.chord-staff-label')].map((label) => label.textContent), ['C♯', 'A', 'F♯', 'E']);
assert.equal(fSharpMinorSeventhStaff.querySelectorAll('.chord-staff-stem').length, 1);
assert.equal(fSharpMinorSeventhStaff.querySelector('.chord-staff-stem').getAttribute('stroke-width'), '0.5');
assert.deepEqual([...fSharpMinorSeventhStaff.querySelectorAll('.chord-staff-label')].map((label) => label.getAttribute('font-size')), ['3.2', '3.2', '3.2', '3.2']);
assert.equal(fSharpMinorSeventhStaff.querySelector('.chord-staff-stem').getAttribute('y2'), '8.85');
assert.deepEqual([...gSharpMinorSixthStaff.querySelectorAll('.chord-staff-label')].map((label) => label.textContent), ['D♯', 'B', 'G♯', 'E♯']);
assert.equal([...gSharpMinorSixthStaff.querySelectorAll('text')].filter((element) => element.textContent === '♯').length, 3);
assert.equal([...eSharpNinthStaff.querySelectorAll('.chord-staff-label')].some((label) => label.textContent === 'F𝄪'), true);
assert.equal(eSharpNinthStaff.querySelector('.chord-staff-label tspan')?.getAttribute('font-size'), '1.9em');
assert.equal(eSharpNinthStaff.querySelector('.chord-staff-label tspan')?.getAttribute('dy'), '0.12em');
assert.equal([...eSharpNinthStaff.querySelectorAll('text')].find((element) => element.textContent === '𝄪')?.getAttribute('font-size'), '6.2');
assert.equal(eSharpNinthDiagram.querySelector('.neck tspan')?.getAttribute('dy'), '-0.20em');
assert.deepEqual([...stackedAccidentalsStaff.querySelectorAll('.chord-staff-accidental')].map((element) => element.getAttribute('data-lane')), ['0', '1', '2']);
assert.deepEqual([...stackedAccidentalsStaff.querySelectorAll('.chord-staff-accidental')].map((element) => element.getAttribute('x')), ['22.5', '18.3', '14.1']);
assert.deepEqual([...aFlatMajorStaff.querySelectorAll('.chord-staff-accidental')].map((element) => element.getAttribute('y')), ['9.9', '6.6']);
assert.equal(bDoubleFlatStaff.querySelector('.chord-staff-accidental')?.textContent, '𝄫');
assert.equal([...bDoubleFlatStaff.querySelector('.chord-staff-accidental')?.textContent ?? ''].length, 1);
assert.equal(bDoubleFlatStaff.querySelector('.chord-staff-accidental')?.getAttribute('y'), bFlatStaff.querySelector('.chord-staff-accidental')?.getAttribute('y'));
assert.deepEqual([...cThirteenthStaff.querySelectorAll('.chord-staff-label')].map((label) => label.getAttribute('font-size')), Array(7).fill('2.6'));
assert.ok(Number(cThirteenthStaff.querySelectorAll('.chord-staff-label')[1].getAttribute('y')) - Number(cThirteenthStaff.querySelectorAll('.chord-staff-label')[0].getAttribute('y')) >= 3);
assert.equal(Number(cMajorStaff.querySelectorAll('.chord-staff-label')[1].getAttribute('y')) - Number(cMajorStaff.querySelectorAll('.chord-staff-label')[0].getAttribute('y')), 4);
assert.equal([...gSharpMinorSixthDiagram.querySelector('.neck').querySelectorAll('text')].some((element) => element.textContent === 'E♯'), true);
assert.equal(svg.textContent?.includes('x'), true);
assert.equal(svg.textContent?.includes('1'), true);
assert.deepEqual([...svg.querySelector('.neck').querySelectorAll('text')].map((element) => element.textContent), ['I', 'x', 'A', 'E', 'A', 'C', 'E']);
assert.equal([...svg.querySelectorAll('text')].find((element) => element.textContent === '1')?.getAttribute('y'), '7');

const generatorTempDirectory = await mkdtemp(join(tmpdir(), 'diagrammer-generator-test-'));
try {
	const sourcePath = join(generatorTempDirectory, 'source.json');
	const outputPath = join(generatorTempDirectory, 'guitar.json');
	await writeFile(sourcePath, JSON.stringify({
		chords: {
			cSharp: [{
				key: 'C#',
				suffix: '7',
				positions: [{ frets: [-1, 4, 3, 4, 2, -1], fingers: [0, 3, 2, 4, 1, 0], baseFret: 1 }],
			}],
			g: [{
				key: 'G',
				suffix: '7/B',
				positions: [{ frets: [-1, 2, 0, 0, 0, 1], fingers: [0, 2, 0, 0, 0, 1], baseFret: 1 }],
			}],
		},
	}));
	execFileSync(process.execPath, [fileURLToPath(new URL('./generate-guitar-dataset.mjs', import.meta.url)), sourcePath, outputPath], { stdio: 'ignore' });
	const generated = JSON.parse(await readFile(outputPath, 'utf8'));
	const generatedCSharpSevenths = generated.filter((item) => item.key === 'C#' && item.type === '7');
	assert.equal(generatedCSharpSevenths.length, 2);
	assert.equal(generatedCSharpSevenths[1].variation, 5);
	assert.equal(generated.filter((item) => item.key === 'G' && item.type === '7' && item.bass === 'B').length, 1);
} finally {
	await rm(generatorTempDirectory, { recursive: true, force: true });
}

console.log('ChordDiagramCollection smoke tests passed');
