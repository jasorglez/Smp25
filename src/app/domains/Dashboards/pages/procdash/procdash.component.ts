import { Component, inject } from '@angular/core';
import * as echarts from 'echarts';
import { DashboardService } from 'app/services/dashboard.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';


@Component({
  selector: 'app-procdash',
  standalone: true,
  imports: [HttpClientModule],
  templateUrl: './procdash.component.html',
  styleUrl: './procdash.component.scss'
})
export class ProcdashComponent {

  async ngOnInit() {
    await this.getContractData();
    this.graphByClassification();
    await this.getStateMap();
    this.graphMap();
  }

  private dashboardService = inject(DashboardService);
  private http = inject(HttpClient);

  categorybyClassification: string[] = [];
  dataByClassification: any[] = [];
  chartByClassification: any;
  chartMap: any;
  estadosColoreados: any;

  async getContractData(): Promise<void> {
    return new Promise((resolve) => {
      this.dashboardService.getContractsByClassification().subscribe(data => {
        this.categorybyClassification = Array.from(new Set(data.map(item => item.speciality)));

        this.dataByClassification = [];
        const stateContracts = Array.from(new Set(data.map(item => item.stateContract)));

        stateContracts.forEach(stateContract => {
          const values = data
            .filter(item => item.stateContract === stateContract)
            .map(item => item.count);

          this.dataByClassification.push({
            name: stateContract,
            values: values
          });
        });
        resolve();
      });
    });
  }

  async getStateMap(): Promise<void> {
    return new Promise((resolve) => {
      this.dashboardService.getOilfieldsByState().subscribe(data => {
        this.estadosColoreados = data.map(item => ({
          name: item.nameState,
          value: item.totalContratos
        }));
        resolve();
      });
    });
  }

  graphByClassification() {
    const chartDivByClassification = document.getElementById('echarts-container-by-classification');
    this.chartByClassification = echarts.init(chartDivByClassification as HTMLElement);

    const optionByClassification = {
      responsive: true,
      title: {
        text: 'Contratos por especialidad'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          // Use axis to trigger tooltip
          type: 'shadow' // 'shadow' as default; can also be 'line' or 'shadow'
        }
      },
      legend: {
        top: 'bottom',
        left: 'center',
        padding: 0
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '13%',
        containLabel: true
      },
      xAxis: {
        type: 'value'
      },
      yAxis: {
        type: 'category',
        data: this.categorybyClassification
      },
      series: [
        // Ciclo para agregar series de 0 a 6
        ...Array.from({ length: 7 }, (_, index) => ({
          name: this.dataByClassification[index]?.name || '', // Asegúrate de que exista un dato
          type: 'bar',
          stack: 'total',
          label: {
            show: true
          },
          emphasis: {
            focus: 'series'
          },
          data: this.dataByClassification[index]?.values || [] // Asegúrate de que exista un dato
        })),
      ]
    };

    this.chartByClassification.setOption(optionByClassification);
  }

  graphMap() {
    const chartDivMap = document.getElementById('echarts-container-map');
    this.chartMap = echarts.init(chartDivMap as HTMLElement);
    
    this.http.get('./assets/files/mexicoHigh.json').subscribe(geoJson => {
      echarts.registerMap('mexico', geoJson as any);
     

      const totalValue = this.estadosColoreados.reduce((sum, estado) => sum + estado.value, 0);

      const optionMap = {
        responsive: true,
        title: {
          text: 'Contratos por estado'
        },
        tooltip: {
          trigger: 'item',
          formatter: (params: { name: string; }) => {
            const estado = this.estadosColoreados.find(e => e.name === params.name);
            if (estado) {
              const percentage = ((estado.value / totalValue) * 100).toFixed(2);
              return `<p><strong>${estado.name}</strong></p><p>Contratos: ${estado.value} <small>(${percentage}%)</small></p>`;
            }
            return '';
          }
        },
        series: [{
          type: 'map',
          map: 'mexico',
          roam: true,
          selectedMode: false,
          itemStyle: {
            areaColor: '#eee',
            borderColor: '#000'
          },
          emphasis: {
            disabled: true
          },
          data: this.estadosColoreados.map(estado => ({
            name: estado.name,
            itemStyle: {
              areaColor: '#d6a00b'
            }
          }))
        }]
      };

      this.chartMap.setOption(optionMap);
      console.log(this.estadosColoreados)
    });

  }
}
