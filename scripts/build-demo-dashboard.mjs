// Builds the demo dashboard JSON for MCP testing (Machine table, Industry connection).
import fs from "node:fs";

const col = (id, name, tableId, valueTypeName, valueTypeNum) => ({
  Id: id,
  Name: name,
  TableId: tableId,
  TableName: null,
  FormulaText: null,
  FormulaValueTypeValidated: null,
  FormulaAggregated: false,
  DisplayedName: name,
  ValueType: {
    Name: valueTypeName,
    ValueType: valueTypeNum,
    IsAutoDetectValueType: false,
    IsNullable: true,
    CharsMaxLength: 1000,
  },
  Aggregate: null,
});

const dataField = (id, columnId, typeEnum, aggregateType, options = "{}") => ({
  id,
  columnId,
  typeEnum,
  aggregateType,
  dateTimeInterval: null,
  isHidden: false,
  order: id - 1,
  visualizationType: null,
  options,
  children: null,
});

const dashboard = {
  Title: { Text: "QA MCP Демо 9.1" },
  DataSources: [
    {
      Id: 0,
      Name: "DataSource-0",
      SourceType: 0,
      DataBase: {
        Connection: { Name: "Industry" },
        Queries: [
          {
            Id: 0,
            Name: "Query",
            Tables: [
              { Id: 0, Name: "Machine", Schema: "dbo", DisplayedName: "Оборудование" },
            ],
            Columns: [
              col(1784451349, "ID", 0, "Integer", 1),
              col(482680917, "Name", 0, "String", 0),
              col(982337268, "ShortName", 0, "String", 0),
              col(1546710919, "MoneyLoose", 0, "Double", 5),
            ],
            Relations: [],
            Grouping: [],
            Filter: null,
            GroupFilter: null,
            RowsLimit: 100,
            Sorting: [],
            Parameters: [],
          },
        ],
      },
      WebApi: null,
      Federation: null,
    },
  ],
  Components: [
    {
      Id: 1,
      Type: "table",
      DataSourceId: 0,
      QueryId: 0,
      DataFields: [
        dataField(1, 482680917, 0, null, '{"customFieldName":{"value":"Оборудование","onlyVisual":true},"tableColumnSize":{"value":250,"onlyVisual":true}}'),
        dataField(2, 982337268, 0, null, '{"tableColumnSize":{"value":180,"onlyVisual":true}}'),
        dataField(3, 1546710919, 1, 1, '{"tableColumnSize":{"value":140,"onlyVisual":true}}'),
      ],
      Filter: null,
      Options:
        '{"name":"table-0","isHeaderVisible":true,"tableColumnHeadersVisible":true,"tableWordWrap":false,"tableColumnFiltersVisible":true,"conditionalFormattingRules":[]}',
      Interactivity: '{"masterFilter":2,"allowEmptyMasterFilter":true}',
    },
  ],
  Layout:
    '{"lg":[{"type":0,"static":false,"isResizable":true,"isDraggable":true,"minW":5,"minH":5,"maxW":60,"maxH":48,"i":"1","x":0,"y":0,"w":30,"h":24,"resizeHandles":["s"]}]}',
  Parameters: [],
  Options: "{}", // never "" — the frontend JSON.parse()s it and renders a blank screen
};

fs.writeFileSync("scripts/demo-dashboard.json", JSON.stringify(dashboard, null, 2), "utf8");
console.log("written:", fs.statSync("scripts/demo-dashboard.json").size, "bytes");
