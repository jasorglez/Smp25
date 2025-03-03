import { Component, inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import * as echarts from 'echarts';
import { DashboardService } from 'app/services/dashboard.service';
import { HttpClient } from '@angular/common/http';
import { ContractsBySpecialityComponent } from "../../components/contracts-by-speciality/contracts-by-speciality.component";
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-procdash',
  standalone: true,
  imports: [ContractsBySpecialityComponent, CommonModule],
  templateUrl: './procdash.component.html',
  styleUrl: './procdash.component.scss'
})
export class ProcdashComponent {
  activeTab: string = 'mxn'; // Pestaña activa por defecto

  // Método para cambiar la pestaña activa
  changeTab(tab: string) {
    this.activeTab = tab;
  }

  async ngOnInit() {
    await this.getContractDataAndGraphByClassification();
    await this.getStateMapAndGraph();
    await this.getTotalContractsAndGraph();
    await this.getInactiveTimesAndGraph();
    await this.getContractsBySeverityAndGraph();
  }

  private dashboardService = inject(DashboardService);
  private http = inject(HttpClient);

  async getContractDataAndGraphByClassification(): Promise<void> {
    const data = await lastValueFrom(this.dashboardService.getContractsByClassification());
    const categoryByClassification = Array.from(new Set(data.map(item => item.speciality)));

    const dataByClassification = Array.from(new Set(data.map(item => item.stateContract)))
      .map(stateContract => ({
        name: stateContract,
        values: data.reduce((acc, item) => {
          if (item.stateContract === stateContract) {
            acc.push(item.count);
          }
          return acc;
        }, [] as number[])
      }));

    const chartDivByClassification = document.getElementById('echarts-container-by-classification');
    const chartByClassification = echarts.init(chartDivByClassification as HTMLElement);

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
        data: categoryByClassification
      },
      series: [
        // Ciclo para agregar series de 0 a 6
        ...Array.from({ length: 7 }, (_, index) => ({
          name: dataByClassification[index]?.name || '', // Asegúrate de que exista un dato
          type: 'bar',
          stack: 'total',
          label: {
            show: true
          },
          emphasis: {
            focus: 'series'
          },
          data: dataByClassification[index]?.values || [] // Asegúrate de que exista un dato
        })),
      ]
    };

    chartByClassification.setOption(optionByClassification);

  }

  async getStateMapAndGraph(): Promise<void> {
    const data = await this.dashboardService.getOilfieldsByState().toPromise();
    const estadosColoreados = data.map(({ nameState, totalContratos }) => ({
      name: nameState,
      value: totalContratos
    }));

    const chartDivMap = document.getElementById('echarts-container-map');
    const chartMap = echarts.init(chartDivMap as HTMLElement);

    this.http.get('./assets/files/mexicoHigh.json').subscribe(geoJson => {
      echarts.registerMap('mexico', geoJson as any);

      const totalValue = estadosColoreados.reduce((sum, estado) => sum + estado.value, 0);

      const optionMap = {
        responsive: true,
        title: {
          text: 'Contratos por estado'
        },
        tooltip: {
          trigger: 'item',
          formatter: (params: { name: string; }) => {
            const estado = estadosColoreados.find(e => e.name === params.name);
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
          data: estadosColoreados.map(estado => ({
            name: estado.name,
            itemStyle: {
              areaColor: '#d6a00b'
            }
          }))
        }]
      };

      chartMap.setOption(optionMap);
    });
  }

  async getTotalContractsAndGraph(): Promise<void> {
    const data = await lastValueFrom(this.dashboardService.getTotalContracts());
    const total = Object.entries(data[0]).map(([key, value]) => ({
      name: key,
      value: value
    })).filter(item => item.name !== 'estDLL' && item.name !== 'remainingDLL') // Filtrar los que terminan con 'DLL'
      .map(item => {
        // Renombrar los datos restantes
        if (item.name === 'estMx') return { name: 'Estimado', value: item.value };
        if (item.name === 'totalContratoMX') return { name: 'Total MXN', value: item.value };
        if (item.name === 'totalContratoDLL') return { name: 'Total DLL', value: item.value };
        if (item.name === 'remainingMX') return { name: 'Restante', value: item.value };
        return item; // Retornar el item sin cambios si no coincide
      });
    console.log(total);

    const chartDivTotal = document.getElementById('echarts-container-total');
    const chartTotal = echarts.init(chartDivTotal as HTMLElement);

    const optionTotal = {
      responsive: true,
      title: {
        text: 'Importe total de contratos'
      },
      graphic: {
        elements: [
          {
            type: 'text',
            left: 'center',
            top: '8%', // Ajusta la posición según sea necesario
            style: {
              text: `Total MXN: $${Number(total.find(item => item.name === 'Total MXN')?.value).toLocaleString('es-MX')}\n\nTotal DLL: $${Number(total.find(item => item.name === 'Total DLL')?.value).toLocaleString('en-US')}`, // Usar el valor total con comas
              font: 'bold 16px sans-serif',
              fill: '#333' // Color del texto
            }
          }
        ]
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: { name: string; value: number; }) => {
          const item = total.find(t => t.name === params.name) as { name: string; value: number };
          return item ? `<strong>${item.name}</strong>: MXN $${Number(item.value).toLocaleString('es-MX')}` : ''; // Usar el valor con comas
        }
      },
      legend: {
        top: 'bottom',
        left: 'center'
      },
      series: [
        {
          top: '8%',
          name: 'Importe total de contratos',
          type: 'pie',
          radius: ['35%', '60%'],
          avoidLabelOverlap: false,
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 40,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: total.filter(item => item.name !== 'Total MXN' && item.name !== 'Total DLL') // Asegúrate de que "Total" no esté en los datos
        }
      ]
    };

    chartTotal.setOption(optionTotal);
  }

  async getInactiveTimesAndGraph(): Promise<void> {
    const data = await lastValueFrom(this.dashboardService.getTotalInactivesByCause());
    const inactiveTimes = data.map(({ cause, totalcause }) => ({
      name: cause,
      value: totalcause
    }));

    // Calcular el total de horas
    const totalHours = inactiveTimes.reduce((sum, item) => sum + item.value, 0);

    const chartDivInactive = document.getElementById('echarts-container-inactive');
    const chartInactive = echarts.init(chartDivInactive as HTMLElement);

    const optionInactive = {
      responsive: true,
      title: {
        text: 'Tiempos inactivos'
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: { name: string; value: number; }) => {
          const item = inactiveTimes.find(t => t.name === params.name) as { name: string; value: number };
          return item ? `<strong>${item.name}</strong>: ${item.value} horas` : '';
        }
      },
      legend: {
        top: 'bottom',
        left: 'center'
      },
      series: [
        {
          name: 'Tiempos inactivos',
          type: 'pie',
          radius: ['35%', '60%'],
          avoidLabelOverlap: false,
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: false,
              fontSize: 40,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: inactiveTimes
        }
      ],
      graphic: {
        elements: [
          {
            type: 'text',
            left: 'center',
            top: 'center',
            style: {
              text: `${totalHours} horas`, // Mostrar el total de horas
              font: 'bold 20px sans-serif',
              fill: '#333' // Color del texto
            }
          }
        ]
      }
    };

    chartInactive.setOption(optionInactive);
  }

  async getContractsBySeverityAndGraph(): Promise<void> {
    const data = await lastValueFrom(this.dashboardService.getTotalSeverity());
    const severity = data.map(({ severityLevel, totalseverity, severity }) => ({
      name: severityLevel,
      value: totalseverity,
      severityCode: severity
    }));

    // Calcular el total de severidades
    const totalSeverityValue = severity.reduce((sum, item) => sum + item.value, 0);

    const chartDivSeverity = document.getElementById('echarts-container-by-severity');
    const chartSeverity = echarts.init(chartDivSeverity as HTMLElement);

    const optionSeverity = {
      responsive: true,
      title: {
        text: 'Impacto y Severidad'
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: { name: string; value: number; }) => {
          const item = severity.find(t => t.name === params.name) as { name: string; value: number };
          if (item) {
            const percentage = ((item.value / totalSeverityValue) * 100).toFixed(2);
            return `<strong>${item.name}</strong>: ${item.value} (${percentage}%)`;
          }
          return '';
        }
      },
      legend: {
        top: 'bottom',
        left: 'center'
      },

      series: [
        {
          name: 'Impacto y Severidad',
          type: 'pie',
          radius: ['35%', '60%'],
          center: ['50%', '50%'],
          roseType: 'area',
          itemStyle: {
            borderRadius: 8
          },
          avoidLabelOverlap: false,
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: false,
              fontSize: 40,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: severity
        }
      ],
      graphic: {
        elements: [
          {
            type: 'text',
            left: 'center',
            top: '8%',
            style: {
              text: `Total de riesgos e incidentes: ${totalSeverityValue}`, // Mostrar el total de horas
              font: 'bold 12px sans-serif',
              fill: '#333' // Color del texto
            }
          }
        ]
      }
    };

    optionSeverity && chartSeverity.setOption(optionSeverity);
  }
}
