import { Component, inject } from '@angular/core';
import * as echarts from 'echarts';
import { DashboardService } from 'app/services/dashboard.service';


@Component({
  selector: 'app-procdash',
  standalone: true,
  imports: [],
  templateUrl: './procdash.component.html',
  styleUrl: './procdash.component.scss'
})
export class ProcdashComponent {

  async ngOnInit() {
    await this.getContractData();
    this.graphByClassification();
  }

  private dashboardService = inject(DashboardService);

  categorybyClassification: string[] = [];
  dataByClassification: any[] = [];

  async getContractData(): Promise<void> {
    return new Promise((resolve) => {
      this.dashboardService.getContractsByClassification().subscribe(data => {
        this.categorybyClassification = Array.from(new Set(data.map(item => item.speciality)));

        console.log(this.categorybyClassification);

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

          console.log(this.dataByClassification);
        });
        resolve();
      });
    });
  }

  chartByClassification: any;

  graphByClassification() {
    const chartDiv = document.getElementById('echarts-container-by-classification');
    this.chartByClassification = echarts.init(chartDiv as HTMLElement);

    const option = {
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

    this.chartByClassification.setOption(option);
  }
}
