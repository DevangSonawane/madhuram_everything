import React, { useState, useEffect } from 'react';

const ChartDataEditor = ({ chartType, chartData, onDataChange, onSave }) => {
  const [localChartData, setLocalChartData] = useState(null);
  const [originalChartData, setOriginalChartData] = useState(null);
  const [error, setError] = useState('');
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredCol, setHoveredCol] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Format number with commas
  const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return '';

    // Check if number has decimals
    if (num % 1 === 0) {
      // Integer - format with commas, no decimals
      return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    } else {
      // Has decimals - format with commas and preserve decimals
      return num.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    }
  };

  // Parse formatted number (remove commas)
  const parseFormattedNumber = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const cleaned = String(value).replace(/,/g, '');
    return cleaned;
  };

  // Validate waterfall chart data
  const validateWaterfallData = (data) => {
    if (!data || !data.series || !data.series.data || !data.series.data[0]) {
      return 'Invalid waterfall data structure';
    }

    const seriesData = data.series.data[0];
    const y = seriesData.y || [];
    const measure = seriesData.measure || [];

    // Check exactly one series
    if (data.series.data.length !== 1) {
      return 'Waterfall charts must have exactly ONE data series';
    }

    // Check measure array exists
    if (!Array.isArray(measure) || measure.length === 0) {
      return 'Waterfall charts must have a measure array';
    }

    // Check measure matches y length
    if (measure.length !== y.length) {
      return 'Measure array must have the same length as Y values';
    }

    // Check first measure is absolute
    if (measure[0] !== 'absolute') {
      return 'First measure must be "absolute"';
    }

    // Check last measure is total
    if (measure[measure.length - 1] !== 'total') {
      return 'Last measure must be "total"';
    }

    // Check middle measures are relative or total
    for (let i = 1; i < measure.length - 1; i++) {
      if (measure[i] !== 'relative' && measure[i] !== 'total') {
        return `Measure at position ${i + 1} must be "relative" or "total" (found "${measure[i]}")`;
      }
    }

    return null; // Valid
  };
  // Deep comparison function
  const deepEqual = (obj1, obj2) => {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;

    // Handle arrays
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (obj1.length !== obj2.length) return false;
      for (let i = 0; i < obj1.length; i++) {
        if (!deepEqual(obj1[i], obj2[i])) return false;
      }
      return true;
    }

    // Handle non-array objects
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
    if (Array.isArray(obj1) || Array.isArray(obj2)) return false;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!deepEqual(obj1[key], obj2[key])) return false;
    }

    return true;
  };

  // Check if data has changed
  const hasChanges = () => {
    if (!localChartData || !originalChartData) return false;
    return !deepEqual(localChartData, originalChartData);
  };

  useEffect(() => {
    // Initialize local state from props
    // Re-initialize when chartData or chartType changes
    if (chartData) {
      try {
        const parsed = typeof chartData === 'string' ? JSON.parse(chartData) : chartData;
        let processedData = JSON.parse(JSON.stringify(parsed));

        // Ensure data structure matches the chart type
        if (processedData && processedData.series && chartType) {
          const type = String(chartType || '').toLowerCase();
          const isPieDonut = type === 'pie' || type === 'donut';
          const series = processedData.series || {};

          // Check current structure
          const hasLabels = Array.isArray(series.labels);
          const hasValues = Array.isArray(series.data?.[0]?.values);
          const hasX = Array.isArray(series.x);
          const hasY = Array.isArray(series.data?.[0]?.y);

          // Transform if needed
          if (isPieDonut) {
            // Pie/Donut needs labels and values
            if ((hasX || hasY) && !(hasLabels && hasValues)) {
              // Convert from bar/line format to pie/donut format
              const x = Array.isArray(series.x) ? series.x : [];
              let yValues = [];

              if (Array.isArray(series.data?.[0]?.y)) {
                yValues = series.data[0].y;
              } else if (Array.isArray(series.data?.[0]?.values)) {
                yValues = series.data[0].values;
              } else if (Array.isArray(series.y)) {
                yValues = series.y;
              } else if (Array.isArray(series.values)) {
                yValues = series.values;
              }

              if (x.length > 0 && yValues.length > 0) {
                const minLength = Math.min(x.length, yValues.length);
                processedData = {
                  ...processedData,
                  series: {
                    ...series,
                    labels: x.slice(0, minLength).map(v => String(v || '')),
                    data: [{ values: yValues.slice(0, minLength).map(v => Number(v) || 0) }]
                  }
                };
                console.log('[ChartDataEditor] Transformed data to pie/donut format');
              }
            } else if (!hasLabels || !hasValues) {
              // Initialize empty structure if missing
              processedData = {
                ...processedData,
                series: {
                  ...series,
                  labels: hasLabels ? series.labels : [],
                  data: hasValues ? series.data : [{ values: [] }]
                }
              };
            }
          } else {
            // Bar/Line needs x and y
            if ((hasLabels && hasValues) && !(hasX && hasY)) {
              // Convert from pie/donut format to bar/line format
              const labels = Array.isArray(series.labels) ? series.labels : [];
              const values = Array.isArray(series.data?.[0]?.values) ? series.data[0].values : [];

              if (labels.length > 0 && values.length > 0) {
                const minLength = Math.min(labels.length, values.length);
                processedData = {
                  ...processedData,
                  series: {
                    ...series,
                    x: labels.slice(0, minLength).map(v => String(v || '')),
                    data: [{ name: 'Series 1', y: values.slice(0, minLength).map(v => Number(v) || 0) }]
                  }
                };
                console.log('[ChartDataEditor] Transformed data to bar/line format');
              }
            } else if (!hasX || !hasY) {
              // Initialize empty structure if missing
              processedData = {
                ...processedData,
                series: {
                  ...series,
                  x: hasX ? series.x : [],
                  data: hasY ? series.data : [{ name: 'Series 1', y: [] }]
                }
              };
            }
          }
        }

        const cloned = JSON.parse(JSON.stringify(processedData));
        setLocalChartData(cloned);
        setOriginalChartData(JSON.parse(JSON.stringify(cloned)));
        setError('');
      } catch (e) {
        console.error('[ChartDataEditor] Error processing chart data:', e);
        setError('Invalid chart data: ' + e.message);
        setLocalChartData(null);
        setOriginalChartData(null);
      }
    } else {
      setLocalChartData(null);
      setOriginalChartData(null);
    }
  }, [chartData, chartType]);

  // Update cell value
  const updateCell = (path, value) => {
    if (!localChartData) return;

    const newData = JSON.parse(JSON.stringify(localChartData));
    let current = newData;

    // Navigate to the parent of the target property
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      // Handle array indices
      if (typeof key === 'number' || (typeof key === 'string' && /^\d+$/.test(key))) {
        const index = parseInt(key, 10);
        if (!Array.isArray(current)) {
          console.error('[updateCell] Expected array at path index', i, 'but got', typeof current);
          return;
        }
        // Ensure array is long enough
        while (current.length <= index) {
          if (path[i + 1] === 'y' || path[i + 1] === 'values') {
            current.push(0);
          } else {
            current.push('');
          }
        }
        current = current[index];
      } else {
        if (!current || typeof current !== 'object') {
          console.error('[updateCell] Expected object at path index', i, 'but got', typeof current);
          return;
        }
        current = current[key];
      }
    }

    // Get the final key
    const finalKey = path[path.length - 1];

    // For numeric paths (y, values), try to parse as number
    const isNumericPath = path.includes('y') || path.includes('values');
    if (isNumericPath) {
      const numValue = value === '' ? 0 : parseFloat(value);
      current[finalKey] = isNaN(numValue) ? 0 : numValue;
    } else {
      current[finalKey] = value;
    }

    // Sync changes with formatting.series_info
    if (newData.formatting && newData.formatting.series_info) {
      const type = String(chartType || '').toLowerCase();
      // For pie/donut charts, sync label changes with formatting.series_info
      if ((type === 'pie' || type === 'donut') && path[0] === 'series' && path[1] === 'labels') {
        const labelIndex = parseInt(path[2], 10);
        if (!isNaN(labelIndex) && newData.formatting.series_info[labelIndex]) {
          newData.formatting.series_info[labelIndex].name = value;
        }
      }

      // For regular charts, sync series name changes with formatting.series_info
      if (path[0] === 'series' && path[1] === 'data' && path[3] === 'name') {
        const seriesIndex = parseInt(path[2], 10);
        if (!isNaN(seriesIndex) && newData.formatting.series_info[seriesIndex]) {
          newData.formatting.series_info[seriesIndex].name = value;
        }
      }
    }

    setLocalChartData(newData);
    if (onDataChange) {
      onDataChange(newData);
    }
  };

  // Add row (at the end)
  const addRow = () => {
    if (!localChartData) return;

    const newData = JSON.parse(JSON.stringify(localChartData));
    const type = String(chartType || '').toLowerCase();

    if (type === 'pie' || type === 'donut') {
      const newLabel = 'New Category';
      newData.series.labels.push(newLabel);
      newData.series.data[0].values.push(0);
      if (newData.formatting && newData.formatting.series_info) {
        newData.formatting.series_info.push({ name: newLabel, color: '#000000' });
      }
    } else if (type.includes('waterfall')) {
      newData.series.x.push('New Item');
      newData.series.data.forEach(series => {
        series.y.push(0);
        if (series.measure) series.measure.push('relative');
      });
    } else {
      newData.series.x.push('New');
      newData.series.data.forEach(series => series.y.push(0));
    }

    setLocalChartData(newData);
    if (onDataChange) {
      onDataChange(newData);
    }
  };

  // Insert row at specific index
  const insertRow = (rowIndex) => {
    if (!localChartData) return;

    const newData = JSON.parse(JSON.stringify(localChartData));
    const type = String(chartType || '').toLowerCase();

    if (type === 'pie' || type === 'donut') {
      const newLabel = 'New Category';
      newData.series.labels.splice(rowIndex, 0, newLabel);
      newData.series.data[0].values.splice(rowIndex, 0, 0);
      if (newData.formatting && newData.formatting.series_info) {
        newData.formatting.series_info.splice(rowIndex, 0, { name: newLabel, color: '#000000' });
      }
    } else if (type.includes('waterfall')) {
      newData.series.x.splice(rowIndex, 0, 'New Item');
      newData.series.data.forEach(series => {
        series.y.splice(rowIndex, 0, 0);
        if (series.measure) series.measure.splice(rowIndex, 0, 'relative');
      });
    } else {
      newData.series.x.splice(rowIndex, 0, 'New');
      newData.series.data.forEach(series => series.y.splice(rowIndex, 0, 0));
    }

    setLocalChartData(newData);
    if (onDataChange) {
      onDataChange(newData);
    }
  };

  // Remove row
  const removeRow = (rowIndex) => {
    if (!localChartData) return;

    const newData = JSON.parse(JSON.stringify(localChartData));
    const type = String(chartType || '').toLowerCase();

    if (type === 'pie' || type === 'donut') {
      if (newData.series.labels.length <= 1) {
        alert('Cannot remove the last row');
        return;
      }
      newData.series.labels.splice(rowIndex, 1);
      newData.series.data[0].values.splice(rowIndex, 1);
      if (newData.formatting && newData.formatting.series_info) {
        newData.formatting.series_info.splice(rowIndex, 1);
      }
    } else if (type.includes('waterfall')) {
      if (newData.series.x.length <= 1) {
        alert('Cannot remove the last row');
        return;
      }
      newData.series.x.splice(rowIndex, 1);
      newData.series.data.forEach(series => {
        series.y.splice(rowIndex, 1);
        if (series.measure) series.measure.splice(rowIndex, 1);
      });
    } else {
      if (newData.series.x.length <= 1) {
        alert('Cannot remove the last row');
        return;
      }
      newData.series.x.splice(rowIndex, 1);
      newData.series.data.forEach(series => series.y.splice(rowIndex, 1));
    }

    setLocalChartData(newData);
    if (onDataChange) {
      onDataChange(newData);
    }
  };

  // Add series/column (at the end)
  const addColumn = () => {
    const type = String(chartType || '').toLowerCase();
    if (type === 'waterfall' || type === 'waterfall_bar' || type === 'waterfall_column') {
      alert('Waterfall charts can only have one series');
      return;
    }

    if (type === 'pie' || type === 'donut') {
      alert('Cannot add series to pie/donut charts');
      return;
    }

    if (!localChartData) return;

    const newData = JSON.parse(JSON.stringify(localChartData));
    const newSeriesName = 'New Series';
    const newSeries = {
      name: newSeriesName,
      y: new Array(newData.series.x.length).fill(0)
    };

    if (chartType.includes('waterfall_stacked')) {
      newSeries.measure = newData.series.data[0].measure.slice();
    }

    newData.series.data.push(newSeries);
    if (newData.formatting && newData.formatting.series_info) {
      newData.formatting.series_info.push({ name: newSeriesName, color: '#000000' });
    }

    setLocalChartData(newData);
    if (onDataChange) {
      onDataChange(newData);
    }
  };

  // Insert column at specific index
  const insertColumn = (colIndex) => {
    const type = String(chartType || '').toLowerCase();
    if (type === 'waterfall' || type === 'waterfall_bar' || type === 'waterfall_column') {
      alert('Waterfall charts can only have one series');
      return;
    }

    if (type === 'pie' || type === 'donut') {
      alert('Cannot add series to pie/donut charts');
      return;
    }

    if (!localChartData) return;

    const newData = JSON.parse(JSON.stringify(localChartData));
    const newSeriesName = 'New Series';
    const newSeries = {
      name: newSeriesName,
      y: new Array(newData.series.x.length).fill(0)
    };

    if (type.includes('waterfall_stacked')) {
      newSeries.measure = newData.series.data[0].measure.slice();
    }

    newData.series.data.splice(colIndex, 0, newSeries);
    if (newData.formatting && newData.formatting.series_info) {
      newData.formatting.series_info.splice(colIndex, 0, { name: newSeriesName, color: '#000000' });
    }

    setLocalChartData(newData);
    if (onDataChange) {
      onDataChange(newData);
    }
  };

  // Remove column
  const removeColumn = (colIndex) => {
    const type = String(chartType || '').toLowerCase();
    if (type === 'waterfall' || type === 'waterfall_bar' || type === 'waterfall_column') {
      alert('Cannot remove the only series from waterfall charts');
      return;
    }

    if (type === 'pie' || type === 'donut') {
      alert('Cannot remove series from pie/donut charts');
      return;
    }

    if (!localChartData) return;

    const newData = JSON.parse(JSON.stringify(localChartData));

    if (newData.series.data.length <= 1) {
      alert('Cannot remove the last column');
      return;
    }

    newData.series.data.splice(colIndex, 1);
    if (newData.formatting && newData.formatting.series_info) {
      newData.formatting.series_info.splice(colIndex, 1);
    }

    setLocalChartData(newData);
    if (onDataChange) {
      onDataChange(newData);
    }
  };

  // Render Excel-like table
  const renderTable = () => {
    if (!localChartData || !localChartData.series) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '16px' }}>
          📋 No chart data available
        </div>
      );
    }

    const type = String(chartType || '').toLowerCase();
    const isPieDonut = type === 'pie' || type === 'donut';
    const isWaterfall = type === 'waterfall' || type === 'waterfall_bar' || type === 'waterfall_column';
    const isWaterfallStacked = type.includes('waterfall_stacked');

    if (isPieDonut) {
      return renderPieTable();
    } else if (isWaterfall) {
      return renderWaterfallTable();
    } else if (isWaterfallStacked) {
      return renderWaterfallStackedTable();
    } else {
      return renderStandardTable();
    }
  };

  // Standard table (bar, column, line, stacked)
  const renderStandardTable = () => {
    // Safely extract x and data with fallbacks
    const series = localChartData?.series || {};
    const x = Array.isArray(series.x) ? series.x : [];
    const data = Array.isArray(series.data) ? series.data : [];

    return (
      <div style={{ overflow: 'auto', width: '100%', position: 'relative', padding: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #d1d5db' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', position: 'relative' }}>
              <th style={cellStyle}></th>
              {data.map((series, idx) => (
                <th
                  key={idx}
                  style={{ ...headerStyle, position: 'relative', overflow: 'visible' }}
                  onMouseEnter={() => setHoveredCol(idx)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingRight: '20px' }}>
                    <input
                      type="text"
                      value={series.name}
                      onChange={(e) => updateCell(['series', 'data', idx, 'name'], e.target.value)}
                      style={{ ...inputStyle, flex: 1, width: '100%' }}
                    />
                    {hoveredCol === idx && (
                      <button
                        onClick={() => removeColumn(idx)}
                        style={removeHeaderButtonStyle}
                        title="Remove column"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {hoveredCol === idx && (
                    <button
                      onClick={() => insertColumn(idx + 1)}
                      style={insertColBetweenButtonStyle}
                      title="Insert column after"
                    >
                      +
                    </button>
                  )}
                </th>
              ))}
              <th
                style={{ ...cellStyle, position: 'relative', minWidth: '40px' }}
                onMouseEnter={() => setHoveredCol(data.length)}
                onMouseLeave={() => setHoveredCol(null)}
              >
                {hoveredCol === data.length && (
                  <button
                    onClick={addColumn}
                    style={insertColBetweenButtonStyle}
                    title="Add column at end"
                  >
                    +
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {x.map((label, rowIdx) => (
              <React.Fragment key={rowIdx}>
                <tr
                  onMouseEnter={() => setHoveredRow(rowIdx)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ position: 'relative' }}
                >
                  <td style={{ ...rowHeaderStyle, position: 'relative' }}>
                    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', paddingRight: '20px' }}>
                      <input
                        type="text"
                        value={label}
                        onChange={(e) => updateCell(['series', 'x', rowIdx], e.target.value)}
                        style={{ ...inputStyle, flex: 1, width: '100%' }}
                      />
                      {hoveredRow === rowIdx && (
                        <button
                          onClick={() => removeRow(rowIdx)}
                          style={removeHeaderButtonStyle}
                          title="Remove row"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {hoveredRow === rowIdx && (
                      <button
                        onClick={() => insertRow(rowIdx)}
                        style={insertRowButtonStyle}
                        title="Insert row above"
                      >
                        +
                      </button>
                    )}
                  </td>
                  {data.map((series, colIdx) => {
                    // Safely access series.y with fallback
                    const seriesY = Array.isArray(series.y) ? series.y : [];
                    const yValue = seriesY[rowIdx] ?? '';

                    return (
                      <td key={colIdx} style={cellStyle}>
                        <input
                          type="text"
                          value={formatNumber(yValue)}
                          onChange={(e) => {
                            const inputValue = parseFormattedNumber(e.target.value);
                            // Update the specific cell value directly
                            // First ensure the y array exists and has enough elements
                            if (!localChartData || !localChartData.series || !localChartData.series.data) return;

                            const newData = JSON.parse(JSON.stringify(localChartData));
                            if (!newData.series.data[colIdx]) return;

                            // Ensure y array exists
                            if (!Array.isArray(newData.series.data[colIdx].y)) {
                              newData.series.data[colIdx].y = [];
                            }

                            // Ensure array is long enough
                            while (newData.series.data[colIdx].y.length <= rowIdx) {
                              newData.series.data[colIdx].y.push(0);
                            }

                            // Update the specific cell
                            const numValue = inputValue === '' ? 0 : parseFloat(inputValue);
                            newData.series.data[colIdx].y[rowIdx] = isNaN(numValue) ? 0 : numValue;

                            setLocalChartData(newData);
                            if (onDataChange) {
                              onDataChange(newData);
                            }
                          }}
                          style={inputStyle}
                        />
                      </td>
                    );
                  })}
                  <td style={cellStyle}></td>
                </tr>
                {hoveredRow === rowIdx && (
                  <tr style={{ height: '2px', position: 'relative' }}>
                    <td colSpan={data.length + 2} style={{ padding: 0, border: 'none', position: 'relative', height: '2px' }}>
                      <button
                        onClick={() => insertRow(rowIdx + 1)}
                        style={insertRowBetweenButtonStyle}
                        title="Insert row below"
                      >
                        +
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            <tr
              onMouseEnter={() => setHoveredRow(x.length)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <td style={{ ...rowHeaderStyle, position: 'relative' }}>
                {hoveredRow === x.length && (
                  <button
                    onClick={addRow}
                    style={insertRowButtonStyle}
                    title="Add row at end"
                  >
                    +
                  </button>
                )}
              </td>
              {data.map((_, colIdx) => (
                <td key={colIdx} style={cellStyle}></td>
              ))}
              <td style={cellStyle}></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Pie/Donut table
  const renderPieTable = () => {
    // Safely extract labels and data with fallbacks
    if (!localChartData || !localChartData.series) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
          <div>Loading chart data...</div>
        </div>
      );
    }

    const series = localChartData.series || {};
    const labels = Array.isArray(series.labels) ? series.labels : [];
    const data = Array.isArray(series.data) ? series.data : [];
    const values = Array.isArray(data[0]?.values) ? data[0].values : [];

    // Validate data structure
    if (labels.length === 0 || values.length === 0) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
          <div>No chart data available. Please add data to display the chart.</div>
        </div>
      );
    }

    return (
      <div style={{ overflow: 'auto', width: '100%', position: 'relative', padding: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #d1d5db' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th style={headerStyle}>Category</th>
              <th style={headerStyle}>Value</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((label, idx) => (
              <React.Fragment key={idx}>
                <tr
                  onMouseEnter={() => setHoveredRow(idx)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ position: 'relative' }}
                >
                  <td style={{ ...rowHeaderStyle, position: 'relative' }}>
                    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', paddingRight: '20px' }}>
                      <input
                        type="text"
                        value={label}
                        onChange={(e) => updateCell(['series', 'labels', idx], e.target.value)}
                        style={{ ...inputStyle, flex: 1, width: '100%' }}
                      />
                      {hoveredRow === idx && (
                        <button
                          onClick={() => removeRow(idx)}
                          style={removeHeaderButtonStyle}
                          title="Remove row"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {hoveredRow === idx && (
                      <button
                        onClick={() => insertRow(idx)}
                        style={insertRowButtonStyle}
                        title="Insert row above"
                      >
                        +
                      </button>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <input
                      type="text"
                      value={formatNumber(values[idx] ?? '')}
                      onChange={(e) => {
                        const inputValue = parseFormattedNumber(e.target.value);
                        if (!localChartData || !localChartData.series || !localChartData.series.data) return;

                        const newData = JSON.parse(JSON.stringify(localChartData));
                        if (!newData.series.data[0]) {
                          newData.series.data[0] = { values: [] };
                        }

                        // Ensure values array exists
                        if (!Array.isArray(newData.series.data[0].values)) {
                          newData.series.data[0].values = [];
                        }

                        // Ensure array is long enough
                        while (newData.series.data[0].values.length <= idx) {
                          newData.series.data[0].values.push(0);
                        }

                        // Update the specific cell
                        const numValue = inputValue === '' ? 0 : parseFloat(inputValue);
                        newData.series.data[0].values[idx] = isNaN(numValue) ? 0 : numValue;

                        setLocalChartData(newData);
                        if (onDataChange) {
                          onDataChange(newData);
                        }
                      }}
                      style={inputStyle}
                    />
                  </td>
                </tr>
                {hoveredRow === idx && (
                  <tr style={{ height: '2px', position: 'relative' }}>
                    <td colSpan={2} style={{ padding: 0, border: 'none', position: 'relative', height: '2px' }}>
                      <button
                        onClick={() => insertRow(idx + 1)}
                        style={insertRowBetweenButtonStyle}
                        title="Insert row below"
                      >
                        +
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            <tr
              onMouseEnter={() => setHoveredRow(labels.length)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <td style={{ ...rowHeaderStyle, position: 'relative' }}>
                {hoveredRow === labels.length && (
                  <button
                    onClick={addRow}
                    style={insertRowButtonStyle}
                    title="Add row at end"
                  >
                    +
                  </button>
                )}
              </td>
              <td style={cellStyle}></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Waterfall table
  const renderWaterfallTable = () => {
    // Safely extract x and data with fallbacks
    if (!localChartData || !localChartData.series) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
          <div>Loading chart data...</div>
        </div>
      );
    }

    const seriesObj = localChartData.series || {};
    const x = Array.isArray(seriesObj.x) ? seriesObj.x : [];
    const data = Array.isArray(seriesObj.data) ? seriesObj.data : [];
    const seriesData = data[0] || {};
    const y = Array.isArray(seriesData.y) ? seriesData.y : [];
    const measure = Array.isArray(seriesData.measure) ? seriesData.measure : [];

    // Validate data structure
    if (x.length === 0) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
          <div>No chart data available. Please add data to display the chart.</div>
        </div>
      );
    }

    return (
      <div style={{ overflow: 'auto', width: '100%', position: 'relative', padding: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #d1d5db' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th style={headerStyle}>Step</th>
              <th style={headerStyle}>Value</th>
              <th style={headerStyle}>Measure</th>
            </tr>
          </thead>
          <tbody>
            {x.map((label, idx) => (
              <React.Fragment key={idx}>
                <tr
                  onMouseEnter={() => setHoveredRow(idx)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ position: 'relative' }}
                >
                  <td style={{ ...rowHeaderStyle, position: 'relative' }}>
                    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', paddingRight: '20px' }}>
                      <input
                        type="text"
                        value={label}
                        onChange={(e) => updateCell(['series', 'x', idx], e.target.value)}
                        style={{ ...inputStyle, flex: 1, width: '100%' }}
                      />
                      {hoveredRow === idx && (
                        <button
                          onClick={() => removeRow(idx)}
                          style={removeHeaderButtonStyle}
                          title="Remove row"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {hoveredRow === idx && (
                      <button
                        onClick={() => insertRow(idx)}
                        style={insertRowButtonStyle}
                        title="Insert row above"
                      >
                        +
                      </button>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <input
                      type="text"
                      value={formatNumber(y[idx] ?? '')}
                      onChange={(e) => {
                        const inputValue = parseFormattedNumber(e.target.value);
                        if (!localChartData || !localChartData.series || !localChartData.series.data) return;

                        const newData = JSON.parse(JSON.stringify(localChartData));
                        if (!newData.series.data[0]) {
                          newData.series.data[0] = { y: [], measure: [] };
                        }

                        // Ensure y array exists
                        if (!Array.isArray(newData.series.data[0].y)) {
                          newData.series.data[0].y = [];
                        }

                        // Ensure array is long enough
                        while (newData.series.data[0].y.length <= idx) {
                          newData.series.data[0].y.push(0);
                        }

                        // Update the specific cell
                        const numValue = inputValue === '' ? 0 : parseFloat(inputValue);
                        newData.series.data[0].y[idx] = isNaN(numValue) ? 0 : numValue;

                        setLocalChartData(newData);
                        if (onDataChange) {
                          onDataChange(newData);
                        }
                      }}
                      style={inputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <select
                      value={measure[idx] ?? 'absolute'}
                      disabled={idx === 0 || idx === measure.length - 1} // ✅ ADD THIS

                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (!localChartData || !localChartData.series || !localChartData.series.data) return;

                        const newData = JSON.parse(JSON.stringify(localChartData));
                        if (!newData.series.data[0]) {
                          newData.series.data[0] = { y: [], measure: [] };
                        }

                        // Ensure measure array exists
                        if (!Array.isArray(newData.series.data[0].measure)) {
                          newData.series.data[0].measure = [];
                        }

                        // Ensure array is long enough
                        while (newData.series.data[0].measure.length <= idx) {
                          newData.series.data[0].measure.push('absolute');
                        }

                        // Update the specific cell
                        newData.series.data[0].measure[idx] = inputValue;

                        setLocalChartData(newData);
                        if (onDataChange) {
                          onDataChange(newData);
                        }
                      }}
                      style={{
                        ...selectStyle,
                        backgroundColor: (idx === 0 || idx === measure.length - 1) ? '#f3f4f6' : 'transparent', // ✅ ADD THIS
                        cursor: (idx === 0 || idx === measure.length - 1) ? 'not-allowed' : 'pointer' // ✅ ADD THIS
                      }}

                    >
                      <option value="absolute">absolute</option>
                      <option value="relative">relative</option>
                      <option value="total">total</option>
                    </select>
                  </td>
                </tr>
                {hoveredRow === idx && (
                  <tr style={{ height: '2px', position: 'relative' }}>
                    <td colSpan={3} style={{ padding: 0, border: 'none', position: 'relative', height: '2px' }}>
                      <button
                        onClick={() => insertRow(idx + 1)}
                        style={insertRowBetweenButtonStyle}
                        title="Insert row below"
                      >
                        +
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            <tr
              onMouseEnter={() => setHoveredRow(x.length)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <td style={{ ...rowHeaderStyle, position: 'relative' }}>
                {hoveredRow === x.length && (
                  <button
                    onClick={addRow}
                    style={insertRowButtonStyle}
                    title="Add row at end"
                  >
                    +
                  </button>
                )}
              </td>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Waterfall Stacked table
  const renderWaterfallStackedTable = () => {
    // Safely extract x and data with fallbacks
    if (!localChartData || !localChartData.series) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
          <div>Loading chart data...</div>
        </div>
      );
    }

    const series = localChartData.series || {};
    const x = Array.isArray(series.x) ? series.x : [];
    const data = Array.isArray(series.data) ? series.data : [];

    // Validate data structure
    if (data.length === 0 || x.length === 0) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
          <div>No chart data available. Please add data to display the chart.</div>
        </div>
      );
    }

    return (
      <div style={{ overflow: 'auto', width: '100%', position: 'relative', padding: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #d1d5db' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th style={cellStyle}></th>
              {data.map((series, idx) => (
                <th
                  key={idx}
                  style={{ ...headerStyle, position: 'relative', overflow: 'visible' }}
                  colSpan={2}
                  onMouseEnter={() => setHoveredCol(idx)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingRight: '20px' }}>
                    <input
                      type="text"
                      value={series.name}
                      onChange={(e) => updateCell(['series', 'data', idx, 'name'], e.target.value)}
                      style={{ ...inputStyle, flex: 1, width: '100%' }}
                    />
                    {hoveredCol === idx && (
                      <button
                        onClick={() => removeColumn(idx)}
                        style={removeHeaderButtonStyle}
                        title="Remove column"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {hoveredCol === idx && (
                    <button
                      onClick={() => insertColumn(idx + 1)}
                      style={insertColBetweenButtonStyle}
                      title="Insert column after"
                    >
                      +
                    </button>
                  )}
                </th>
              ))}
              <th
                style={{ ...cellStyle, position: 'relative', minWidth: '40px' }}
                onMouseEnter={() => setHoveredCol(data.length)}
                onMouseLeave={() => setHoveredCol(null)}
              >
                {hoveredCol === data.length && (
                  <button
                    onClick={addColumn}
                    style={insertColBetweenButtonStyle}
                    title="Add column at end"
                  >
                    +
                  </button>
                )}
              </th>
            </tr>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={headerStyle}>Step</th>
              {data.map((_, idx) => (
                <React.Fragment key={idx}>
                  <th style={headerStyle}>Value</th>
                  <th style={headerStyle}>Measure</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {x.map((label, rowIdx) => (
              <React.Fragment key={rowIdx}>
                <tr
                  onMouseEnter={() => setHoveredRow(rowIdx)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ position: 'relative' }}
                >
                  <td style={{ ...rowHeaderStyle, position: 'relative' }}>
                    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', paddingRight: '20px' }}>
                      <input
                        type="text"
                        value={label}
                        onChange={(e) => updateCell(['series', 'x', rowIdx], e.target.value)}
                        style={{ ...inputStyle, flex: 1, width: '100%' }}
                      />
                      {hoveredRow === rowIdx && (
                        <button
                          onClick={() => removeRow(rowIdx)}
                          style={removeHeaderButtonStyle}
                          title="Remove row"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {hoveredRow === rowIdx && (
                      <button
                        onClick={() => insertRow(rowIdx)}
                        style={insertRowButtonStyle}
                        title="Insert row above"
                      >
                        +
                      </button>
                    )}
                  </td>
                  {data.map((series, colIdx) => {
                    // Safely access series properties with fallbacks
                    const seriesY = Array.isArray(series.y) ? series.y : [];
                    const seriesMeasure = Array.isArray(series.measure) ? series.measure : [];

                    // Ensure arrays are long enough for the current row index
                    const yValue = seriesY[rowIdx] ?? '';
                    const measureValue = seriesMeasure[rowIdx] ?? 'absolute';

                    return (
                      <React.Fragment key={colIdx}>
                        <td style={cellStyle}>
                          <input
                            type="text"
                            value={formatNumber(yValue)}
                            onChange={(e) => {
                              const inputValue = parseFormattedNumber(e.target.value);
                              if (!localChartData || !localChartData.series || !localChartData.series.data) return;

                              const newData = JSON.parse(JSON.stringify(localChartData));
                              if (!newData.series.data[colIdx]) {
                                newData.series.data[colIdx] = { y: [], measure: [] };
                              }

                              // Ensure y array exists
                              if (!Array.isArray(newData.series.data[colIdx].y)) {
                                newData.series.data[colIdx].y = [];
                              }

                              // Ensure array is long enough
                              while (newData.series.data[colIdx].y.length <= rowIdx) {
                                newData.series.data[colIdx].y.push(0);
                              }

                              // Update the specific cell
                              const numValue = inputValue === '' ? 0 : parseFloat(inputValue);
                              newData.series.data[colIdx].y[rowIdx] = isNaN(numValue) ? 0 : numValue;

                              setLocalChartData(newData);
                              if (onDataChange) {
                                onDataChange(newData);
                              }
                            }}
                            style={inputStyle}
                          />
                        </td>
                        <td style={cellStyle}>
                          <select
                            value={measureValue}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              if (!localChartData || !localChartData.series || !localChartData.series.data) return;

                              const newData = JSON.parse(JSON.stringify(localChartData));
                              if (!newData.series.data[colIdx]) {
                                newData.series.data[colIdx] = { y: [], measure: [] };
                              }

                              // Ensure measure array exists
                              if (!Array.isArray(newData.series.data[colIdx].measure)) {
                                newData.series.data[colIdx].measure = [];
                              }

                              // Ensure array is long enough
                              while (newData.series.data[colIdx].measure.length <= rowIdx) {
                                newData.series.data[colIdx].measure.push('absolute');
                              }

                              // Update the specific cell
                              newData.series.data[colIdx].measure[rowIdx] = inputValue;

                              setLocalChartData(newData);
                              if (onDataChange) {
                                onDataChange(newData);
                              }
                            }}
                            style={selectStyle}
                          >
                            <option value="absolute">absolute</option>
                            <option value="relative">relative</option>
                            <option value="total">total</option>
                          </select>
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
                {hoveredRow === rowIdx && (
                  <tr style={{ height: '2px', position: 'relative' }}>
                    <td colSpan={data.length * 2 + 1} style={{ padding: 0, border: 'none', position: 'relative', height: '2px' }}>
                      <button
                        onClick={() => insertRow(rowIdx + 1)}
                        style={insertRowBetweenButtonStyle}
                        title="Insert row below"
                      >
                        +
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            <tr
              onMouseEnter={() => setHoveredRow(x.length)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <td style={{ ...rowHeaderStyle, position: 'relative' }}>
                {hoveredRow === x.length && (
                  <button
                    onClick={addRow}
                    style={insertRowButtonStyle}
                    title="Add row at end"
                  >
                    +
                  </button>
                )}
              </td>
              {data.map((_, colIdx) => (
                <React.Fragment key={colIdx}>
                  <td style={cellStyle}></td>
                  <td style={cellStyle}></td>
                </React.Fragment>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Styles
  const cellStyle = {
    border: '1px solid #d1d5db',
    padding: '0',
    textAlign: 'center',
    backgroundColor: 'white',
    position: 'relative'
  };

  const headerStyle = {
    border: '1px solid #d1d5db',
    padding: '8px',
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: '#f3f4f6',
    position: 'relative'
  };

  const rowHeaderStyle = {
    border: '1px solid #d1d5db',
    padding: '0',
    textAlign: 'left',
    fontWeight: '600',
    backgroundColor: '#f9fafb',
    position: 'relative'
  };

  const inputStyle = {
    width: '100%',
    border: 'none',
    padding: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    textAlign: 'center',
    backgroundColor: 'transparent'
  };

  const selectStyle = {
    width: '100%',
    border: 'none',
    padding: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    backgroundColor: 'transparent',
    cursor: 'pointer'
  };

  const addButtonStyle = {
    padding: '4px 8px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    width: '100%'
  };

  const removeButtonStyle = {
    padding: '2px 6px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    marginLeft: '4px'
  };

  const insertRowButtonStyle = {
    position: 'absolute',
    left: '-12px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '24px',
    height: '24px',
    padding: '0',
    backgroundColor: '#10b981',
    color: 'white',
    border: '2px solid white',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  };

  const insertColBetweenButtonStyle = {
    position: 'absolute',
    top: '50%',
    right: '-12px',
    transform: 'translateY(-50%)',
    width: '24px',
    height: '24px',
    padding: '0',
    backgroundColor: '#10b981',
    color: 'white',
    border: '2px solid white',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  };

  const removeHeaderButtonStyle = {
    position: 'absolute',
    right: '4px',
    top: '50%',
    transform: 'translateY(-50%)',
    padding: '2px 6px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    zIndex: 5
  };

  const insertRowBetweenButtonStyle = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '24px',
    height: '24px',
    padding: '0',
    backgroundColor: '#10b981',
    color: 'white',
    border: '2px solid white',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  };

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#ef4444', backgroundColor: '#fee2e2', borderRadius: '8px', marginBottom: '10px' }}>
        ❌ {error}
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Chart Data Editor</h3>
        {onSave && (
          <button
            onClick={async () => {
              if (onSave && !isSaving) {
                // ✅ ADD VALIDATION HERE
                const type = String(chartType || '').toLowerCase();
                if (type === 'waterfall' || type === 'waterfall_bar' || type === 'waterfall_column') {
                  const validationError = validateWaterfallData(localChartData);
                  if (validationError) {
                    alert('Validation Error: ' + validationError);
                    return;
                  }
                }

                setIsSaving(true);
                try {
                  await onSave(localChartData);
                  // Update original data after successful save
                  setOriginalChartData(JSON.parse(JSON.stringify(localChartData)));
                } catch (err) {
                  console.error('Error saving chart data:', err);
                  // Error is already handled by onSave callback
                } finally {
                  setIsSaving(false);
                }
              }
            }}
          >
            {isSaving ? (
              <>
                <div style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0
                }} />
                <span>Saving...</span>
              </>
            ) : (
              '💾 Save Changes'
            )}
          </button>
        )}
      </div>

      <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white', overflow: 'auto', maxHeight: '600px', minHeight: '200px' }}>
        {renderTable()}
      </div>
    </div>
  );
};

export default ChartDataEditor;

