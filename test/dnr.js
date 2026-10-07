
const types = {
  int: {
    defaultValue: 0,
    tester: value => /^([+-]?[1-9]\d*|0)$/.test(value),
    parser: Number.parseInt,
    operators: {
      "+"(operand1, operand2) {
        return operand1.value + operand2.value;
      }
    }
  },
  float: {
    defaultValue: 0,
    tester: value => /^([+-]?[1-9]\d*|0)$/.test(value),
    parser: Number.parseFloat,
    casts: {
      int: value => Number.parseInt(value)
    }
  },
  char: {
    defaultValue: "",
    tester: value => /^'.*'$/.test(value),
    parser: value => value.length === 2 ? '' : value[1]
  }
};

function parse(code = "") {
  window.onload = () => document.body.innerHTML = `<pre>${ code }</pre>`;
  const lines = code.split(/\n|;/g);
  const statements =  lines
    .map(line => line.trim())
    .filter(line => line !== "");

  const variables = {};

  for(const statement of statements) {

    for(const [typeName, typeInfo] of Object.entries(types)) {

      const typeIndex = statement.indexOf(typeName);

      if(typeIndex === 0) {
        statement.slice(typeIndex + typeName.length).split(",").forEach(identifier => {
          const [ name, value = typeInfo.defaultValue ] = identifier.trim().split("=").map(token => token.trim());
          if(name in types) {
            throw `TypeName: type name is not allowed as an identifier`;
          }
          if(name in variables) {
            throw `Redeclaration: variable '${ name }' already declared`;
          }
          if(value && !typeInfo.tester(value)) {
            throw `TypeError: '${ value }' is an invalid value for type '${ typeName }'.`;
          }
          variables[name] = {
            value: typeInfo.parser(value),
            type: typeName
          };
        });
      }

    }

    for(const [varName, varInfo] of Object.entries(variables)) {

      const varIndex = statement.indexOf(varName);

      if(varIndex === 0) {
        const subStatements = statement.slice(varIndex + varName.length).split("=").reverse();
        for(const subStatement of subStatements) {
          // subStatement[0].
        }
      }

    }

  }
  return {
    variables
  }
}

const operators = {
  "=": {
    type: "binary"
  },
  "+": {
    type: "binary"
  }
};

const operatorTypes = {
  2: {
    evaluator(operator, operand1, operand2) {
      const operand1Type = types[operand1.type];
      const operand2Type = types[operand2.type];
      if(operator in operand1Type === false) {
        throw `Opearator: '${ operator }' operator cannot operate on '${ operand1.type }' type.`;
      }
      if(operand1.type !== operand2.type) {
        if(operand1.type in operand2Type.casts === false) {
          throw `TypeCast: '${ operand2.value }' cannot be casted to '${ operand1.type }'.`;
        }
      }
      return operand1Type.operators[operator](operand1, operand2);
    }
  }
}

function handleOperation(operator, operands = []) {
  operatorTypes[operands.length].evaluator(operator, ...operands);
}


const data = parse(`
int v1, v2 = 0, v3;
float g = 12;
char c = '';
v1 = v1 + v2; v2 = 10;
function f() {
  return 10;
}
`);
console.log(data);
