import { Component, ElementRef, Input, OnChanges, OnInit, ViewChild } from '@angular/core';
import * as d3 from 'd3';

@Component({
  selector: 'app-d3-telemetry',
  standalone: true,
  template: `<div #chartContainer class="w-full h-full opacity-60"></div>`,
  styles: [`
    :host { display: block; height: 40px; margin-top: 10px; }
  `]
})
export class D3TelemetryComponent implements OnInit, OnChanges {
  @ViewChild('chartContainer', { static: true }) private chartContainer!: ElementRef;
  @Input() data: number[] = [];
  @Input() color: string = '#00ff88';

  private svg: any;
  private width = 200;
  private height = 40;

  ngOnInit() {
    this.createSvg();
    this.drawChart();
  }

  ngOnChanges() {
    if (this.svg) {
      this.drawChart();
    }
  }

  private createSvg(): void {
    const element = this.chartContainer.nativeElement;
    this.width = element.offsetWidth || 200;

    this.svg = d3.select(element)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'none');
  }

  private drawChart(): void {
    if (!this.data || this.data.length === 0) return;

    this.svg.selectAll('*').remove();

    // Setup scales
    const x = d3.scaleLinear().domain([0, this.data.length - 1]).range([0, this.width]);
    const y = d3.scaleLinear().domain([0, d3.max(this.data) as number]).range([this.height, 5]);

    // Create area generator
    const area = d3.area<number>()
      .x((d: any, i: number) => x(i))
      .y0(this.height)
      .y1((d: any) => y(d))
      .curve(d3.curveMonotoneX);

    // Create line generator
    const line = d3.line<number>()
      .x((d: any, i: number) => x(i))
      .y((d: any) => y(d))
      .curve(d3.curveMonotoneX);

    // Add gradient
    const defs = this.svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'areaGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', this.color)
      .attr('stop-opacity', 0.5);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', this.color)
      .attr('stop-opacity', 0);

    // Draw area path
    this.svg.append('path')
      .datum(this.data)
      .attr('fill', 'url(#areaGradient)')
      .attr('d', area);

    // Draw top line
    const path = this.svg.append('path')
      .datum(this.data)
      .attr('fill', 'none')
      .attr('stroke', this.color)
      .attr('stroke-width', 2)
      .attr('d', line);

    // Animate line
    const totalLength = path.node().getTotalLength();
    path
      .attr('stroke-dasharray', totalLength + ' ' + totalLength)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(2000)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);
  }
}
