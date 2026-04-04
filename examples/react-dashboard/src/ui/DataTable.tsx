import type { TablePayload } from "../dashboard/types";

interface DataTableProps {
  payload: TablePayload;
}

export function DataTable({ payload }: DataTableProps): JSX.Element {
  return (
    <div className="table-wrapper">
      <table className="widget-table">
        <thead>
          <tr>
            {payload.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payload.rows.map((row, rowIndex) => (
            <tr key={`${row.page ?? "row"}-${rowIndex}`}>
              {payload.columns.map((column) => {
                const value = row[column.toLowerCase()] ?? row[column] ?? "-";
                return <td key={`${rowIndex}-${column}`}>{value}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
