/**
 * CASE STUDIO UML 2.5 - DATA MODELS
 * Definición formal del metamodelo conceptual de clases UML, diagramas estructurales y de comportamiento.
 * Compatible con especificación OMG UML 2.5 y Enterprise Architect (XMI 2.1).
 */

export type UmlVisibility = '+' | '-' | '#' | '~';

export type UmlDataType = 
  | 'Long'
  | 'Integer'
  | 'String'
  | 'Double'
  | 'Float'
  | 'Boolean'
  | 'LocalDate'
  | 'LocalDateTime'
  | 'BigDecimal'
  | 'byte[]'
  | 'Text';

export type UmlElementType = 
  | 'CLASS'              // Clase / Entidad tradicional
  | 'ASSOCIATION_CLASS'  // Rombo de Asociación / Clase de asociación
  | 'DECISION'           // Rombo de decisión / bifurcación lógica
  | 'INTERFACE'          // <<interface>>
  | 'ENUM'               // <<enumeration>>
  | 'PACKAGE'            // Paquete contenedor
  | 'LIFELINE'           // Línea de vida / Objeto para Secuencia
  | 'ACTOR'              // Actor del sistema
  | 'NOTE';              // Nota adhesiva / Comentario

export type UmlRelationType = 
  | 'ASSOCIATION'        // Asociación simple (-->)
  | 'ONE_TO_ONE'         // 1 a 1 (1 .. 1)
  | 'ONE_TO_MANY'        // 1 a N (1 .. 0..*)
  | 'MANY_TO_ONE'        // N a 1 (* .. 1)
  | 'MANY_TO_MANY'       // N a M (* .. *)
  | 'INHERITANCE'        // Herencia / Generalización (--|>)
  | 'COMPOSITION'        // Composición fuerte (*-diamante negro)
  | 'AGGREGATION'        // Agregación débil (o-diamante blanco)
  | 'DEPENDENCY'         // Dependencia (..>)
  | 'REALIZATION'        // Realización / Implementación (--|>)
  | 'SEQUENCE_MESSAGE';  // Mensaje síncrono de secuencia (->)

export interface UmlAttribute {
  id: string;
  name: string;
  type: UmlDataType | string;
  visibility: UmlVisibility;
  isPrimaryKey?: boolean;
  isNullable?: boolean;
  defaultValue?: string;
  description?: string;
}

export interface UmlMethodParam {
  name: string;
  type: UmlDataType | string;
}

export interface UmlMethod {
  id: string;
  name: string;
  returnType: UmlDataType | string;
  visibility: UmlVisibility;
  parameters?: UmlMethodParam[];
}

export interface UmlClass {
  id: string;
  name: string;
  elementType?: UmlElementType; // 'CLASS' | 'DECISION' | 'ASSOCIATION_CLASS' | etc.
  stereotype?: string; // e.g. '<<entity>>', '<<service>>', '<<interface>>', '<<enum>>'
  isAbstract?: boolean;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
  position: { x: number; y: number };
  width?: number;
  height?: number;
  colorHeader?: string;
  noteContent?: string; // Texto para elementos de tipo 'NOTE'
  lockedBy?: string | null; // Control de exclusión mutua / concurrencia
  lockedByName?: string | null;
  updatedAt?: string;
}

export interface UmlRelation {
  id: string;
  sourceClassId: string;
  targetClassId: string;
  type: UmlRelationType;
  name?: string;
  label?: string;
  sourceRole?: string;
  targetRole?: string;
  sourceMultiplicity?: string; // '1', '0..1', '*', '1..*'
  targetMultiplicity?: string; // '1', '0..1', '*', '1..*'
}

export interface UmlDiagram {
  id: string;
  name: string;
  description?: string;
  classes: UmlClass[];
  relations: UmlRelation[];
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface XmiValidationReport {
  isValid: boolean;
  totalClasses: number;
  totalRelations: number;
  checks: { title: string; status: 'pass' | 'warning' | 'fail'; detail: string }[];
}
