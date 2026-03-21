export const apexChartsTheme = {
  colors: {
    primary: '#0d6efd',
    secondary: '#6c757d',
    success: '#10b981', // Emerald
    danger: '#ef4444',  // Rose/Red
    warning: '#f59e0b', // Amber
    info: '#0ea5e9',    // Sky
    emerald: '#10b981',
    rose: '#ef4444',
    violet: '#8b5cf6',
    slate: '#64748b',
  },
  options: {
    chart: {
      fontFamily: 'Inter, system-ui, sans-serif',
      foreColor: '#64748b',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 150
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      },
      toolbar: {
        show: false
      }
    },
    grid: {
      borderColor: '#f1f5f9',
      strokeDashArray: 4,
    },
    xaxis: {
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      labels: {
        style: {
          fontSize: '12px',
          fontWeight: 500,
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: '12px',
          fontWeight: 500,
        },
      },
    },
    tooltip: {
      theme: 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      x: {
        show: true,
      },
      marker: {
        show: true,
      },
    },
    legend: {
      fontSize: '13px',
      fontWeight: 600,
      labels: {
        colors: '#334155',
      },
      markers: {
        width: 10,
        height: 10,
        radius: 12,
      },
    },
  }
};
