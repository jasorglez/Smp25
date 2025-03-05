import { Component, inject, AfterViewInit } from '@angular/core';
import { DashboardService } from 'app/services/dashboard.service';
import * as echarts from 'echarts';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-contracts-by-speciality',
  standalone: true,
  imports: [],
  template: `
      <ul class="nav nav-tabs" id="myTab" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" data-bs-toggle="tab" (click)="changeCurrency('mxn')">MXN</button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" data-bs-toggle="tab" (click)="changeCurrency('usd')">DLL</button>
      </li>
    </ul>
    <div id="echarts-container-by-speciality" style="width: 100%; height: 35vh;"></div>
  `
})
export class ContractsBySpecialityComponent implements AfterViewInit {
  private dashboardService = inject(DashboardService);
  private chartBySpeciality: any;
  public currency: 'mxn' | 'usd' = 'mxn'; // Propiedad para controlar la moneda

  async ngAfterViewInit() {
    await this.getContractsBySpecialityAndGraph();
  }

  async changeCurrency(currency: 'mxn' | 'usd') {
    this.currency = currency; // Cambiar la moneda
    await this.getContractsBySpecialityAndGraph(); // Volver a cargar los datos
  }

  async getContractsBySpecialityAndGraph(): Promise<void> {
    const data = await lastValueFrom(this.dashboardService.getContractsBySpeciality());
    const transformedData = this.transformData(data);

    const categoryByClassification = Array.from(new Set(data.map(item => item.speciality)));
    const chartDivBySpeciality = document.getElementById('echarts-container-by-speciality');

    if (this.chartBySpeciality) {
      this.chartBySpeciality.dispose();
    }

    this.chartBySpeciality = echarts.init(chartDivBySpeciality as HTMLElement);
    const optionBySpeciality = {
      title: {
        text: `Montos por clasificación (${this.currency === 'mxn' ? 'MXN' : 'DLL'})`
      },
      tooltip: {
        trigger: 'axis',
        valueFormatter: value => `${this.currency === 'mxn' ? 'MXN $' : 'DLL $'}${value.toLocaleString(this.currency === 'mxn' ? 'es-MX' : 'en-US')}`,
      },
      xAxis: {
        type: 'category',
        data: categoryByClassification
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => (value / 1000000).toFixed(2) + 'M', // Formatear el valor en millones
          align: 'right', // Alinear el texto a la derecha
          padding: [0, -20, 0, 0] // Añadir padding a la derecha
        }
      },
      series: [
        ...Array.from({ length: 3 }, (_, index) => ({
          name: transformedData[index]?.name || '',
          type: 'bar',
          stack: 'total',
          label: {
            show: true,
            formatter: (params: { value: number }) => (params.value / 1000000).toFixed(2) + 'M' // Formatear el valor
          },
          emphasis: {
            focus: 'series'
          },
          data: transformedData[index]?.value || []
        })),
      ],
      legend: {
        top: 'bottom',
        left: 'center',
        padding: 0
      },
    };

    this.chartBySpeciality.setOption(optionBySpeciality);
  }

  transformData(data: any[]): any[] {
    const nameMap: { [key: string]: string } = {
      'estMx': 'Estimados',
      'totalContratoMX': 'Total',
      'remainingMX': 'Restante',
      'estDLL': 'Estimados',
      'totalContratoDLL': 'Total',
      'remainingDLL': 'Restante'
    };

    const keys = Object.keys(data[0]).filter(key => 
      key.toLowerCase().endsWith(this.currency === 'mxn' ? 'mx' : 'dll')
    );

    return keys.map(key => ({
      name: nameMap[key],
      value: data.map(item => item[key])
    }));
  }
}