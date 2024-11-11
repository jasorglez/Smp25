import { Component, inject } from '@angular/core';
import { DashboardService } from 'app/services/dashboard.service';
import * as echarts from 'echarts';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-contracts-by-speciality-mxn',
  standalone: true,
  imports: [],
  template: `<div id="echarts-container-by-speciality" style="width: 100%; height: 40vh;"></div>`
})
export class ContractsBySpecialityMxnComponent {
  private dashboardService = inject(DashboardService);
  
  async ngOnInit() {
  await this.getContractsBySpecialityAndGraph();
}

  async getContractsBySpecialityAndGraph(): Promise<void> {
    const data = await lastValueFrom(this.dashboardService.getContractsBySpeciality());
    const transformedData = this.transformData(data);

    const categoryByClassification = Array.from(new Set(data.map(item => item.speciality)));

    const chartDivBySpeciality = document.getElementById('echarts-container-by-speciality');
    const chartBySpeciality = echarts.init(chartDivBySpeciality as HTMLElement);

    const optionBySpeciality = {
      responsive: true,
      title: {
        text: 'Montos por clasificación'
      },
      tooltip: {
        trigger: 'axis',
        valueFormatter: value => 'MXN $' + value.toLocaleString('es-MX'),
        axisPointer: {
          // Use axis to trigger tooltip
          type: 'line' // 'shadow' as default; can also be 'line' or 'shadow'
        },
        
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
      yAxis: {
        type: 'value'
      },
      xAxis: {
        type: 'category',
        data: categoryByClassification
      },
      series: [
        // Ciclo para agregar series de 0 a 2
        ...Array.from({ length: 3 }, (_, index) => ({
          name: transformedData[index]?.name || '', // Asegúrate de que exista un dato
          type: 'bar',
          stack: 'total',
          label: {
            show: true,
            formatter: (params: { value: number }) => (params.value / 1000000).toFixed(2) + 'M' // Formatear el valor
          },
          emphasis: {
            focus: 'series'
          },
          data: transformedData[index]?.value || [] // Asegúrate de que exista un dato
        })),
      ]
    };

    chartBySpeciality.setOption(optionBySpeciality);
  }

  transformData(data: any[]): any[] {
    // Mapa para traducir los nombres
    const nameMap: { [key: string]: string } = {
      'estMx': 'Estimados',
      'totalContratoMX': 'Total',
      'remainingMX': 'Restante'
    };

    // Obtenemos las keys que terminan en Mx o MX
    const mxKeys = Object.keys(data[0]).filter(key =>
      key.toLowerCase().endsWith('mx')
    );

    // Transformamos los datos
    return mxKeys.map(key => ({
      name: nameMap[key], // Usamos el nombre traducido
      value: data.map(item => item[key])
    }));
  }
}
