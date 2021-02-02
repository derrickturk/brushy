/* this is the observablehq example
 * from https://observablehq.com/@d3/brushable-scatterplot-matrix
 * ported to typescript
 */

interface PenguinNumeric {
    culmen_length_mm: number;
    culmen_depth_mm: number;
    flipper_length_mm: number;
    body_mass_g: number;
}

interface Penguin extends PenguinNumeric {
    species: string;
    island: string;
    sex: string;
}

// TODO: code generation from PenguinNumeric? 
const PENGUIN_NUMERIC_COLUMNS: (keyof PenguinNumeric)[] = [
    'culmen_length_mm',
    'culmen_depth_mm',
    'flipper_length_mm',
    'body_mass_g',
];

const PADDING = 28;
const WIDTH = 954;

async function getPenguins(): Promise<d3.DSVParsedArray<Penguin>>
{
    const csv = await fetch('penguins.csv');
    return d3.csvParse<Penguin, string>(await csv.text(), d3.autoType);
}

function safeExtent<T>(xs: T[], f: (x: T) => number): [number, number]
{
    const base = d3.extent(xs, f);
    if (typeof base[0] === 'number')
        return (<[number, number]>base);
    return [0, 1];
}

function makePlot(data: d3.DSVParsedArray<Penguin>)
{
    const size = (WIDTH - (PENGUIN_NUMERIC_COLUMNS.length + 1) * PADDING)
      / PENGUIN_NUMERIC_COLUMNS.length + PADDING;
    const svg = d3.select('#graph')
      .append('svg')
        .attr('viewBox', `${-PADDING} 0 ${WIDTH} ${WIDTH}`);

    const xScales = PENGUIN_NUMERIC_COLUMNS.map(c => {
        return d3.scaleLinear()
          .domain(safeExtent(data, penguin => penguin[c]))
          .rangeRound([PADDING / 2, size - PADDING / 2]);
    });

    const yScales = PENGUIN_NUMERIC_COLUMNS.map(c => {
        return d3.scaleLinear()
          .domain(safeExtent(data, penguin => penguin[c]))
          .rangeRound([size - PADDING / 2, PADDING / 2]);
    });

    const xAxisG = svg.append('g');
    xAxisG
      .selectAll('g')
      .data(PENGUIN_NUMERIC_COLUMNS)
      .join('g')
      .attr('transform', (d, i) => `translate(${i * size},0)`)
      .each(function (d, i) {
          const axis = d3.axisBottom(xScales[i])
            .ticks(6)
            .tickSize(size * PENGUIN_NUMERIC_COLUMNS.length);
          d3.select(<SVGGElement>this)
            .call(axis)
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line').attr('stroke', '#ddd'));
       });

    const yAxisG = svg.append('g');
    yAxisG
      .selectAll('g')
      .data(PENGUIN_NUMERIC_COLUMNS)
      .join('g')
      .attr('transform', (d, i) => `translate(0,${i * size})`)
      .each(function (d, i) {
          const axis = d3.axisLeft(yScales[i])
            .ticks(6)
            .tickSize(-size * PENGUIN_NUMERIC_COLUMNS.length);
          d3.select(<SVGGElement>this)
            .call(axis)
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line').attr('stroke', '#ddd'));
       });

    const cell = svg.append('g')
      .selectAll('g')
      .data(d3.cross(
         d3.range(PENGUIN_NUMERIC_COLUMNS.length),
         d3.range(PENGUIN_NUMERIC_COLUMNS.length)))
      .join('g')
      .attr('transform', ([i, j]) => `translate(${i * size},${j * size})`);

    cell.append('rect')
      .attr('fill', 'none')
      .attr('stroke', '#aaa')
      .attr('x', PADDING / 2 + 0.5)
      .attr('y', PADDING / 2 + 0.5)
      .attr('width', size - PADDING)
      .attr('height', size - PADDING);

    const color = d3.scaleOrdinal<string>()
      .domain(data.map(d => d.species))
      .range(d3.schemeCategory10);

    cell.each(function ([i, j]) {
        d3.select(<SVGGElement>this)
          .selectAll('circle')
          .data(data.filter(
             d => !isNaN(d[PENGUIN_NUMERIC_COLUMNS[i]])
               && !isNaN(d[PENGUIN_NUMERIC_COLUMNS[j]])))
          .join('circle')
          .attr('cx', d => xScales[i](d[PENGUIN_NUMERIC_COLUMNS[i]]))
          .attr('cy', d => yScales[j](d[PENGUIN_NUMERIC_COLUMNS[j]]))
    });

    let circle = cell.selectAll('circle')
      .attr('r', 3.5)
      .attr('fill-opacity', 0.7)
      .attr('fill', d => color((<Penguin>d).species));

    // TODO: brush
    const brush = d3.brush<[number, number]>()
      .extent([[PADDING / 2, PADDING / 2],
               [size - PADDING / 2, size - PADDING / 2]]);

    // the fuck
    brush(
      <d3.Selection<SVGGElement, [number, number], SVGGElement, unknown>>cell);

    let brushCell: SVGGElement;

    brush
      .on('start', function () {
           if (brushCell !== this) {
               brush.move(d3.select(brushCell), null);
               brushCell = this;
           }
       })
      .on('brush', function ({selection}: d3.D3BrushEvent<[number, number]>,
                     [i, j]: [number, number]) {
           let selected: Penguin[] = [];
           if (selection) {
               // it's 2-D, but TS doesn't know that
               const [[x0, y0], [x1, y1]] =
                 <[[number, number], [number, number]]>selection;

               function isPicked(data: Penguin) {
                   const x = xScales[i](data[PENGUIN_NUMERIC_COLUMNS[i]]);
                   const y = yScales[j](data[PENGUIN_NUMERIC_COLUMNS[j]]);
                   return x0 <= x && x1 >= x && y0 <= y && y1 >= y;
               }

               circle.classed('hidden', d => !isPicked(<Penguin>d));
               selected = data.filter(isPicked);
           }
           svg.property('value', selected).dispatch('input');
       })
      .on('end', function ({selection}: d3.D3BrushEvent<[number, number]>) {
           if (selection)
               return;
           svg.property('value', []).dispatch('input');
           circle.classed('hidden', false);
       });

    svg.append('g')
      .selectAll('text')
      .data(PENGUIN_NUMERIC_COLUMNS)
      .join('text')
      .attr('class', 'label')
      .attr('transform', (d, i) => `translate(${i * size},${i * size})`)
      .attr('x', PADDING)
      .attr('y', PADDING)
      .attr('dy', '.71em')
      .text(d => d);

    svg.property('value', []);
}

export default function brushy()
{
    getPenguins().then(makePlot);
}
