import { Injectable, inject, signal } from '@angular/core';
import { UmlClass, UmlRelation, UmlAttribute, UmlDataType } from '../models/uml.models';
import { ZipPackerService, ZipFileEntry } from './zip-packer.service';

export interface GeneratedProjectFiles {
  projectName: string;
  files: ZipFileEntry[];
  postmanCollectionJson: string;
  schemaSql: string;
  pomXml: string;
  applicationProperties: string;
  entityFiles: { className: string; path: string; content: string }[];
  controllerFiles: { className: string; path: string; content: string }[];
  serviceFiles: { className: string; path: string; content: string }[];
  dtoFiles: { className: string; path: string; content: string }[];
  repositoryFiles: { className: string; path: string; content: string }[];
}

export interface GeneratedBackendHistoryItem {
  id: string;
  ownerId: string; // ID del usuario dueño que generó el backend
  projectId?: string;
  projectName: string;
  generatedAt: string;
  classesCount: number;
  relationsCount: number;
  classNames: string[];
  zipBlob?: Blob;
  postmanJson: string;
  schemaSql: string;
}

const HISTORY_STORAGE_KEY = 'case_generated_backends_history';

@Injectable({
  providedIn: 'root'
})
export class SpringBootGeneratorService {
  private zipPacker = inject(ZipPackerService);

  history = signal<GeneratedBackendHistoryItem[]>(this.loadHistory());

  private loadHistory(): GeneratedBackendHistoryItem[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('No se pudo cargar historial de backends:', e);
      return [];
    }
  }

  private saveHistoryItem(item: GeneratedBackendHistoryItem): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const current = this.loadHistory();
      // Guardar sin el blob para no exceder quota de localStorage
      const itemToStore = { ...item, zipBlob: undefined };
      const updated = [itemToStore, ...current.filter(i => i.id !== item.id)].slice(0, 20);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      this.history.set(updated);
    } catch (e) {
      console.warn('Error guardando en historial:', e);
    }
  }

  /**
   * Genera el conjunto completo de archivos del proyecto Spring Boot 3 + PostgreSQL + Postman
   */
  generateProject(classes: UmlClass[], relations: UmlRelation[], rawProjectName: string = 'sistema-backend'): GeneratedProjectFiles {
    const projectName = this.slugify(rawProjectName) || 'sistema-backend';
    const basePackage = 'com.sistema';
    const packagePath = `src/main/java/com/sistema`;
    const resourcesPath = `src/main/resources`;

    const allFiles: ZipFileEntry[] = [];
    const entityFiles: { className: string; path: string; content: string }[] = [];
    const controllerFiles: { className: string; path: string; content: string }[] = [];
    const serviceFiles: { className: string; path: string; content: string }[] = [];
    const dtoFiles: { className: string; path: string; content: string }[] = [];
    const repositoryFiles: { className: string; path: string; content: string }[] = [];

    // 1. pom.xml
    const pomXml = this.generatePomXml(projectName);
    allFiles.push({ path: 'pom.xml', content: pomXml });

    // 2. application.properties
    const applicationProperties = this.generateApplicationProperties(projectName);
    allFiles.push({ path: `${resourcesPath}/application.properties`, content: applicationProperties });

    // 3. schema.sql (DDL para PostgreSQL)
    const schemaSql = this.generatePostgresDdl(classes, relations);
    allFiles.push({ path: `${resourcesPath}/schema.sql`, content: schemaSql });

    // 4. Clase principal Spring Boot
    const mainApp = this.generateMainApplicationClass();
    allFiles.push({ path: `${packagePath}/SistemaApplication.java`, content: mainApp });

    // Script ejecutable de soporte Maven Wrapper para Windows (.cmd)
    const mvnwCmd = `@rem Maven Wrapper Script for Windows\r\n@echo off\r\nif "%1"=="spring-boot:run" (\r\n  mvn spring-boot:run\r\n) else (\r\n  mvn %*\r\n)\r\n`;
    allFiles.push({ path: 'mvnw.cmd', content: mvnwCmd });

    // Script ejecutable para Linux/Mac
    const mvnwLinux = `#!/bin/sh\nif [ "$1" = "spring-boot:run" ]; then\n  mvn spring-boot:run\nelse\n  mvn "$@"\nfi\n`;
    allFiles.push({ path: 'mvnw', content: mvnwLinux });

    // 5. Configuración CORS
    const corsConfig = this.generateCorsConfig();
    allFiles.push({ path: `${packagePath}/config/CorsConfig.java`, content: corsConfig });

    // 6. Generar capa completa por cada Clase UML
    for (const cls of classes) {
      const clsName = this.toPascalCase(cls.name);

      // Model Entity
      const entityContent = this.generateEntity(cls, relations, classes);
      const entityPath = `${packagePath}/model/${clsName}.java`;
      allFiles.push({ path: entityPath, content: entityContent });
      entityFiles.push({ className: clsName, path: entityPath, content: entityContent });

      // DTO
      const dtoContent = this.generateDTO(cls);
      const dtoPath = `${packagePath}/dto/${clsName}DTO.java`;
      allFiles.push({ path: dtoPath, content: dtoContent });
      dtoFiles.push({ className: clsName, path: dtoPath, content: dtoContent });

      // Repository
      const repoContent = this.generateRepository(cls);
      const repoPath = `${packagePath}/repository/${clsName}Repository.java`;
      allFiles.push({ path: repoPath, content: repoContent });
      repositoryFiles.push({ className: clsName, path: repoPath, content: repoContent });

      // Service
      const serviceContent = this.generateService(cls);
      const servicePath = `${packagePath}/service/${clsName}Service.java`;
      allFiles.push({ path: servicePath, content: serviceContent });
      serviceFiles.push({ className: clsName, path: servicePath, content: serviceContent });

      // Controller
      const controllerContent = this.generateController(cls);
      const controllerPath = `${packagePath}/controller/${clsName}Controller.java`;
      allFiles.push({ path: controllerPath, content: controllerContent });
      controllerFiles.push({ className: clsName, path: controllerPath, content: controllerContent });
    }

    // 7. Colección de Postman v2.1.0
    const postmanCollectionJson = this.generatePostmanCollection(classes, projectName);
    allFiles.push({ path: 'postman_collection.json', content: postmanCollectionJson });

    // 8. Docker Compose para PostgreSQL
    const dockerCompose = this.generateDockerCompose(projectName);
    allFiles.push({ path: 'docker-compose.yml', content: dockerCompose });

    // 9. README.md explicativo
    const readme = this.generateReadme(projectName, classes);
    allFiles.push({ path: 'README.md', content: readme });

    return {
      projectName,
      files: allFiles,
      postmanCollectionJson,
      schemaSql,
      pomXml,
      applicationProperties,
      entityFiles,
      controllerFiles,
      serviceFiles,
      dtoFiles,
      repositoryFiles
    };
  }

  /**
   * Genera el archivo ZIP binario y registra la generación en el historial privado del dueño
   */
  async buildZipArchive(
    project: GeneratedProjectFiles, 
    classes: UmlClass[], 
    relations: UmlRelation[],
    ownerId: string = '',
    projectId?: string
  ): Promise<Blob> {
    const blob = await this.zipPacker.createZip(project.files);

    const historyItem: GeneratedBackendHistoryItem = {
      id: 'gen_' + Date.now(),
      ownerId: ownerId,
      projectId: projectId,
      projectName: project.projectName,
      generatedAt: new Date().toISOString(),
      classesCount: classes.length,
      relationsCount: relations.length,
      classNames: classes.map(c => this.toPascalCase(c.name)),
      zipBlob: blob,
      postmanJson: project.postmanCollectionJson,
      schemaSql: project.schemaSql
    };

    this.saveHistoryItem(historyItem);
    return blob;
  }

  /**
   * Descarga únicamente la colección de Postman
   */
  downloadPostmanCollection(postmanJson: string, projectName: string): void {
    const filename = `${this.slugify(projectName)}_postman_collection.json`;
    this.zipPacker.downloadText(postmanJson, filename, 'application/json');
  }

  /**
   * Descarga únicamente el Script SQL DDL de PostgreSQL
   */
  downloadSchemaSql(sqlContent: string, projectName: string): void {
    const filename = `${this.slugify(projectName)}_schema.sql`;
    this.zipPacker.downloadText(sqlContent, filename, 'application/sql');
  }

  // ==========================================
  // GENERADORES DE CÓDIGO SPRING BOOT Y POSTGRES
  // ==========================================

  private generatePomXml(projectName: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.3</version>
        <relativePath/>
    </parent>
    <groupId>com.sistema</groupId>
    <artifactId>${projectName}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <name>${projectName}</name>
    <description>Backend API REST con Spring Boot, PostgreSQL y JPA generado por CASE Tool</description>

    <properties>
        <java.version>17</java.version>
    </properties>

    <dependencies>
        <!-- Spring Boot Web para Endpoints REST -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <!-- Spring Data JPA con Hibernate -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>

        <!-- Conector Driver oficial PostgreSQL -->
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>

        <!-- Validaciones de Bean Validation -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <!-- Lombok para Getters, Setters y Constructores -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- Testing Starter -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`;
  }

  private generateApplicationProperties(projectName: string): string {
    const dbName = this.slugify(projectName).replace(/-/g, '_') + '_db';
    return `# ===================================================================
# CONFIGURACIÓN DEL BACKEND SPRING BOOT Y BASE DE DATOS POSTGRESQL
# ===================================================================
spring.application.name=${projectName}
server.port=8080

# 1. Parámetros de Conexión a PostgreSQL
spring.datasource.url=jdbc:postgresql://localhost:5432/${dbName}
spring.datasource.username=postgres
spring.datasource.password=postgres
spring.datasource.driver-class-name=org.postgresql.Driver

# 2. Configuración de Hibernate y JPA
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect

# 3. Formato y serialización JSON
spring.jackson.date-format=yyyy-MM-dd HH:mm:ss
spring.jackson.time-zone=UTC

# 4. Logs informativos para desarrollo
logging.level.org.springframework.web=INFO
logging.level.org.hibernate.SQL=DEBUG
`;
  }

  private generateMainApplicationClass(): string {
    return `package com.sistema;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class SistemaApplication {

    public static void main(String[] args) {
        SpringApplication.run(SistemaApplication.class, args);
        System.out.println("=================================================");
        System.out.println("🚀 BACKEND SPRING BOOT + POSTGRESQL INICIADO EXITOSAMENTE");
        System.out.println("📡 Endpoints listos en: http://localhost:8080/api/");
        System.out.println("=================================================");
    }
}
`;
  }

  private generateCorsConfig(): string {
    return `package com.sistema.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

/**
 * Configuración global de CORS para permitir la conexión fluida
 * desde aplicaciones móviles (Flutter) y web (Angular / React).
 */
@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedHeaders(List.of("Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}
`;
  }

  private generateEntity(cls: UmlClass, relations: UmlRelation[], allClasses: UmlClass[]): string {
    const className = this.toPascalCase(cls.name);
    const tableName = this.toSnakeCase(cls.name);

    let hasId = cls.attributes.some(a => a.isPrimaryKey || a.name.toLowerCase() === 'id');
    const imports = new Set<string>([
      'jakarta.persistence.*',
      'lombok.*',
      'java.io.Serializable',
      'com.fasterxml.jackson.annotation.JsonIgnoreProperties'
    ]);

    // Relaciones de entrada y salida
    const incomingRels = relations.filter(r => r.targetClassId === cls.id);
    const outgoingRels = relations.filter(r => r.sourceClassId === cls.id);

    let fieldsCode = '';

    // Si la clase no tiene ID explícito, crear uno autogenerado
    if (!hasId) {
      fieldsCode += `    @Id\n    @GeneratedValue(strategy = GenerationType.IDENTITY)\n    private Long id;\n\n`;
    }

    for (const attr of cls.attributes) {
      const fieldName = this.toCamelCase(attr.name);
      const javaType = this.toJavaType(attr.type, imports);
      const isPk = attr.isPrimaryKey || fieldName === 'id';

      if (isPk) {
        fieldsCode += `    @Id\n    @GeneratedValue(strategy = GenerationType.IDENTITY)\n`;
      } else {
        const colName = this.toSnakeCase(attr.name);
        fieldsCode += `    @Column(name = "${colName}", nullable = ${attr.isNullable !== false})\n`;
      }
      fieldsCode += `    private ${javaType} ${fieldName};\n\n`;
    }

    // Mapeo de Relaciones JPA
    // 1. Relaciones salientes (Source -> Target)
    for (const rel of outgoingRels) {
      const targetCls = allClasses.find(c => c.id === rel.targetClassId);
      if (!targetCls) continue;
      const targetName = this.toPascalCase(targetCls.name);
      const targetField = this.toCamelCase(targetCls.name);

      if (rel.type === 'ONE_TO_MANY') {
        imports.add('java.util.List');
        imports.add('java.util.ArrayList');
        fieldsCode += `    // Relación 1..* hacia ${targetName}\n`;
        fieldsCode += `    @OneToMany(mappedBy = "${this.toCamelCase(className)}", cascade = CascadeType.ALL, orphanRemoval = true)\n`;
        fieldsCode += `    @JsonIgnoreProperties("${this.toCamelCase(className)}")\n`;
        fieldsCode += `    @Builder.Default\n`;
        fieldsCode += `    private List<${targetName}> ${targetField}List = new ArrayList<>();\n\n`;
      } else if (rel.type === 'MANY_TO_ONE' || rel.type === 'ONE_TO_ONE') {
        fieldsCode += `    // Relación hacia ${targetName}\n`;
        if (rel.type === 'ONE_TO_ONE') {
          fieldsCode += `    @OneToOne(fetch = FetchType.LAZY)\n    @JoinColumn(name = "${targetField}_id", unique = true)\n`;
        } else {
          fieldsCode += `    @ManyToOne(fetch = FetchType.LAZY)\n    @JoinColumn(name = "${targetField}_id")\n`;
        }
        fieldsCode += `    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})\n`;
        fieldsCode += `    private ${targetName} ${targetField};\n\n`;
      } else if (rel.type === 'MANY_TO_MANY') {
        imports.add('java.util.List');
        imports.add('java.util.ArrayList');
        const joinTable = `${tableName}_${this.toSnakeCase(targetCls.name)}`;
        fieldsCode += `    // Relación *..* hacia ${targetName}\n`;
        fieldsCode += `    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE})\n`;
        fieldsCode += `    @JoinTable(\n        name = "${joinTable}",\n        joinColumns = @JoinColumn(name = "${tableName}_id"),\n        inverseJoinColumns = @JoinColumn(name = "${this.toSnakeCase(targetCls.name)}_id")\n    )\n`;
        fieldsCode += `    @JsonIgnoreProperties("${this.toCamelCase(className)}List")\n`;
        fieldsCode += `    @Builder.Default\n`;
        fieldsCode += `    private List<${targetName}> ${targetField}List = new ArrayList<>();\n\n`;
      }
    }

    // 2. Relaciones entrantes (Target de una relación ONE_TO_MANY previa)
    for (const rel of incomingRels) {
      const sourceCls = allClasses.find(c => c.id === rel.sourceClassId);
      if (!sourceCls) continue;
      const sourceName = this.toPascalCase(sourceCls.name);
      const sourceField = this.toCamelCase(sourceCls.name);

      if (rel.type === 'ONE_TO_MANY') {
        // En el lado target de un 1..*, agregamos el @ManyToOne inverso
        fieldsCode += `    // Lado ManyToOne inverso de relación desde ${sourceName}\n`;
        fieldsCode += `    @ManyToOne(fetch = FetchType.LAZY)\n`;
        fieldsCode += `    @JoinColumn(name = "${sourceField}_id")\n`;
        fieldsCode += `    @JsonIgnoreProperties("${this.toCamelCase(className)}List")\n`;
        fieldsCode += `    private ${sourceName} ${sourceField};\n\n`;
      }
    }

    const importsArray = Array.from(imports).sort().map(i => `import ${i};`).join('\n');

    return `package com.sistema.model;

${importsArray}

/**
 * Entidad JPA persistente mapeada a la tabla PostgreSQL '${tableName}'
 */
@Entity
@Table(name = "${tableName}")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ${className} implements Serializable {

    private static final long serialVersionUID = 1L;

${fieldsCode}}
`;
  }

  private generateDTO(cls: UmlClass): string {
    const className = this.toPascalCase(cls.name);
    const imports = new Set<string>(['lombok.*', 'java.io.Serializable']);

    let fields = '';
    for (const attr of cls.attributes) {
      const name = this.toCamelCase(attr.name);
      const type = this.toJavaType(attr.type, imports);
      fields += `    private ${type} ${name};\n`;
    }

    const importsArray = Array.from(imports).sort().map(i => `import ${i};`).join('\n');

    return `package com.sistema.dto;

${importsArray}

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ${className}DTO implements Serializable {

    private static final long serialVersionUID = 1L;

${fields}}
`;
  }

  private generateRepository(cls: UmlClass): string {
    const className = this.toPascalCase(cls.name);
    return `package com.sistema.repository;

import com.sistema.model.${className};
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ${className}Repository extends JpaRepository<${className}, Long> {
}
`;
  }

  private generateService(cls: UmlClass): string {
    const className = this.toPascalCase(cls.name);
    const varName = this.toCamelCase(cls.name);

    return `package com.sistema.service;

import com.sistema.model.${className};
import com.sistema.dto.${className}DTO;
import com.sistema.repository.${className}Repository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class ${className}Service {

    @Autowired
    private ${className}Repository ${varName}Repository;

    @Transactional(readOnly = true)
    public List<${className}> findAll() {
        return ${varName}Repository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<${className}> findById(Long id) {
        return ${varName}Repository.findById(id);
    }

    public ${className} save(${className} entity) {
        return ${varName}Repository.save(entity);
    }

    public Optional<${className}> update(Long id, ${className} updatedEntity) {
        return ${varName}Repository.findById(id).map(existing -> {
            // Actualizar campos preservando el ID primario
            updatedEntity.setId(id);
            return ${varName}Repository.save(updatedEntity);
        });
    }

    public boolean deleteById(Long id) {
        if (${varName}Repository.existsById(id)) {
            ${varName}Repository.deleteById(id);
            return true;
        }
        return false;
    }
}
`;
  }

  private generateController(cls: UmlClass): string {
    const className = this.toPascalCase(cls.name);
    const varName = this.toCamelCase(cls.name);
    const endpoint = this.toSnakeCase(cls.name).replace(/_/g, '-');

    return `package com.sistema.controller;

import com.sistema.model.${className};
import com.sistema.service.${className}Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/${endpoint}")
@CrossOrigin(origins = "*")
public class ${className}Controller {

    @Autowired
    private ${className}Service ${varName}Service;

    @GetMapping
    public ResponseEntity<List<${className}>> getAll() {
        return ResponseEntity.ok(${varName}Service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<${className}> getById(@PathVariable Long id) {
        return ${varName}Service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<${className}> create(@RequestBody ${className} entity) {
        ${className} created = ${varName}Service.save(entity);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<${className}> update(@PathVariable Long id, @RequestBody ${className} entity) {
        return ${varName}Service.update(id, entity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (${varName}Service.deleteById(id)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
`;
  }

  private generatePostgresDdl(classes: UmlClass[], relations: UmlRelation[]): string {
    let sql = `-- ===================================================================\n`;
    sql += `-- SCRIPT DDL PARA BASE DE DATOS POSTGRESQL (OMG UML 2.5)\n`;
    sql += `-- Generado automáticamente por CASE Tool Enterprise\n`;
    sql += `-- Fecha: ${new Date().toISOString()}\n`;
    sql += `-- ===================================================================\n\n`;

    for (const cls of classes) {
      const tableName = this.toSnakeCase(cls.name);
      sql += `DROP TABLE IF EXISTS ${tableName} CASCADE;\n`;
      sql += `CREATE TABLE ${tableName} (\n`;

      let hasId = cls.attributes.some(a => a.isPrimaryKey || a.name.toLowerCase() === 'id');
      const lines: string[] = [];

      if (!hasId) {
        lines.push(`    id BIGSERIAL PRIMARY KEY`);
      }

      for (const attr of cls.attributes) {
        const colName = this.toSnakeCase(attr.name);
        const isPk = attr.isPrimaryKey || colName === 'id';
        const pgType = this.toPostgresType(attr.type, isPk);
        const nullClause = isPk || attr.isNullable === false ? 'NOT NULL' : '';
        const pkClause = isPk ? 'PRIMARY KEY' : '';
        lines.push(`    ${colName} ${pgType} ${nullClause} ${pkClause}`.trim().replace(/\s+/g, ' '));
      }

      sql += lines.join(',\n') + '\n);\n\n';
    }

    // Tablas intermedias para relaciones MANY_TO_MANY
    const m2mRelations = relations.filter(r => r.type === 'MANY_TO_MANY');
    for (const rel of m2mRelations) {
      const srcCls = classes.find(c => c.id === rel.sourceClassId);
      const tgtCls = classes.find(c => c.id === rel.targetClassId);
      if (!srcCls || !tgtCls) continue;

      const t1 = this.toSnakeCase(srcCls.name);
      const t2 = this.toSnakeCase(tgtCls.name);
      const joinName = `${t1}_${t2}`;

      sql += `-- Tabla intermedia para relación muchos a muchos: ${srcCls.name} <-> ${tgtCls.name}\n`;
      sql += `DROP TABLE IF EXISTS ${joinName} CASCADE;\n`;
      sql += `CREATE TABLE ${joinName} (\n`;
      sql += `    ${t1}_id BIGINT NOT NULL REFERENCES ${t1}(id) ON DELETE CASCADE,\n`;
      sql += `    ${t2}_id BIGINT NOT NULL REFERENCES ${t2}(id) ON DELETE CASCADE,\n`;
      sql += `    PRIMARY KEY (${t1}_id, ${t2}_id)\n`;
      sql += `);\n\n`;
    }

    return sql;
  }

  private generatePostmanCollection(classes: UmlClass[], projectName: string): string {
    const items = classes.map(cls => {
      const clsName = this.toPascalCase(cls.name);
      const endpoint = this.toSnakeCase(cls.name).replace(/_/g, '-');
      const sampleObj: any = {};

      for (const a of cls.attributes) {
        const fieldName = this.toCamelCase(a.name);
        if (a.isPrimaryKey || fieldName === 'id') continue;
        sampleObj[fieldName] = this.getSampleValue(a.type, fieldName);
      }

      const sampleJson = JSON.stringify(sampleObj, null, 2);

      return {
        name: `Entidad: ${clsName}`,
        item: [
          {
            name: `1. Listar todos los ${clsName}`,
            request: {
              method: 'GET',
              header: [],
              url: {
                raw: `{{baseUrl}}/api/${endpoint}`,
                host: ['{{baseUrl}}'],
                path: ['api', endpoint]
              }
            }
          },
          {
            name: `2. Obtener ${clsName} por ID`,
            request: {
              method: 'GET',
              header: [],
              url: {
                raw: `{{baseUrl}}/api/${endpoint}/1`,
                host: ['{{baseUrl}}'],
                path: ['api', endpoint, '1']
              }
            }
          },
          {
            name: `3. Crear nuevo ${clsName}`,
            request: {
              method: 'POST',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              body: {
                mode: 'raw',
                raw: sampleJson
              },
              url: {
                raw: `{{baseUrl}}/api/${endpoint}`,
                host: ['{{baseUrl}}'],
                path: ['api', endpoint]
              }
            }
          },
          {
            name: `4. Actualizar ${clsName}`,
            request: {
              method: 'PUT',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              body: {
                mode: 'raw',
                raw: sampleJson
              },
              url: {
                raw: `{{baseUrl}}/api/${endpoint}/1`,
                host: ['{{baseUrl}}'],
                path: ['api', endpoint, '1']
              }
            }
          },
          {
            name: `5. Eliminar ${clsName}`,
            request: {
              method: 'DELETE',
              header: [],
              url: {
                raw: `{{baseUrl}}/api/${endpoint}/1`,
                host: ['{{baseUrl}}'],
                path: ['api', endpoint, '1']
              }
            }
          }
        ]
      };
    });

    const collection = {
      info: {
        _postman_id: 'col_' + Date.now(),
        name: `${projectName} - API REST Spring Boot (CRUD)`,
        description: `Colección de pruebas automáticas para el backend Spring Boot con PostgreSQL generado por CASE Tool.`,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      variable: [
        {
          key: 'baseUrl',
          value: 'http://localhost:8080',
          type: 'string'
        }
      ],
      item: items
    };

    return JSON.stringify(collection, null, 2);
  }

  private generateDockerCompose(projectName: string): string {
    const dbName = this.slugify(projectName).replace(/-/g, '_') + '_db';
    return `version: '3.8'

services:
  postgres-db:
    image: postgres:16-alpine
    container_name: ${projectName}-postgres
    restart: always
    environment:
      POSTGRES_DB: ${dbName}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./src/main/resources/schema.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  postgres_data:
`;
  }

  private generateReadme(projectName: string, classes: UmlClass[]): string {
    return `# ${projectName} - Backend Spring Boot 3 + PostgreSQL

Proyecto generado automáticamente por la herramienta **CASE Tool Enterprise**.

## 📋 Entidades Incluidas (${classes.length})
${classes.map(c => `- **${this.toPascalCase(c.name)}** (${c.attributes.length} atributos, ${c.methods.length} métodos)`).join('\n')}

---

## 🚀 Requisitos Previos
- **Java 17 o 21** instalado (\`java -version\`)
- **Maven 3.8+** instalado o usa el wrapper incluido
- **PostgreSQL 14+** corriendo en el puerto 5432 (o Docker)

---

## 🐘 1. Levantar PostgreSQL con Docker (Opción Rápida)
\`\`\`bash
docker compose up -d
\`\`\`
Esto creará la base de datos automáticamente con el usuario \`postgres\` y clave \`postgres\`.

---

## ⚙️ 2. Ejecutar el Backend
\`\`\`bash
# Con Maven Wrapper
./mvnw spring-boot:run

# O con Maven instalado
mvn spring-boot:run
\`\`\`

El servidor arrancará en: **http://localhost:8080**

---

## 📮 3. Probar con Postman (1 Clic)
1. Abre Postman.
2. Haz clic en **Import** (arriba a la izquierda).
3. Selecciona el archivo \`postman_collection.json\` incluido en la raíz de este proyecto.
4. ¡Listo! Ya tienes todas las peticiones \`GET\`, \`POST\`, \`PUT\` y \`DELETE\` configuradas con cuerpos JSON listos para probar.
`;
  }

  // ==========================================
  // HELPERS DE TIPOS Y NOMBRES
  // ==========================================

  private toJavaType(type: UmlDataType | string, imports: Set<string>): string {
    const clean = (type || 'String').toLowerCase();
    if (clean === 'long' || clean === 'id') return 'Long';
    if (clean === 'int' || clean === 'integer') return 'Integer';
    if (clean === 'double') return 'Double';
    if (clean === 'float') return 'Float';
    if (clean === 'boolean' || clean === 'bool') return 'Boolean';
    if (clean.includes('date') && !clean.includes('time')) {
      imports.add('java.time.LocalDate');
      return 'LocalDate';
    }
    if (clean.includes('datetime') || clean.includes('timestamp')) {
      imports.add('java.time.LocalDateTime');
      return 'LocalDateTime';
    }
    if (clean === 'bigdecimal' || clean.includes('decimal') || clean.includes('precio') || clean.includes('monto')) {
      imports.add('java.math.BigDecimal');
      return 'BigDecimal';
    }
    return 'String';
  }

  private toPostgresType(type: UmlDataType | string, isPk: boolean): string {
    if (isPk) return 'BIGSERIAL';
    const clean = (type || 'String').toLowerCase();
    if (clean === 'long' || clean === 'id') return 'BIGINT';
    if (clean === 'int' || clean === 'integer') return 'INTEGER';
    if (clean === 'double') return 'DOUBLE PRECISION';
    if (clean === 'float') return 'REAL';
    if (clean === 'boolean' || clean === 'bool') return 'BOOLEAN';
    if (clean.includes('date') && !clean.includes('time')) return 'DATE';
    if (clean.includes('datetime') || clean.includes('timestamp')) return 'TIMESTAMP';
    if (clean === 'bigdecimal' || clean.includes('decimal')) return 'NUMERIC(14,2)';
    if (clean === 'text') return 'TEXT';
    return 'VARCHAR(255)';
  }

  private getSampleValue(type: UmlDataType | string, fieldName: string): any {
    const clean = (type || 'String').toLowerCase();
    const fLower = fieldName.toLowerCase();

    if (clean === 'long' || clean === 'int' || clean === 'integer') {
      if (fLower.includes('edad')) return 25;
      if (fLower.includes('numero') || fLower.includes('tarjeta')) return 100234;
      return 1;
    }
    if (clean === 'double' || clean === 'float' || clean === 'bigdecimal') {
      if (fLower.includes('saldo') || fLower.includes('precio') || fLower.includes('total')) return 250.50;
      return 99.99;
    }
    if (clean === 'boolean' || clean === 'bool') return true;
    if (clean.includes('date')) return '2026-05-15';

    if (fLower.includes('correo') || fLower.includes('email')) return 'usuario@sistema.com';
    if (fLower.includes('telefono') || fLower.includes('celular')) return '+591 70000000';
    if (fLower.includes('nombre')) return 'Juan Perez';
    if (fLower.includes('matricula')) return 'MAT-2026-01';
    return `${fieldName} de prueba`;
  }

  private toPascalCase(str: string): string {
    const clean = (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s_]/g, ' ').trim();
    if (!clean) return 'Clase';
    return clean.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  private toSnakeCase(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
      .replace(/^_|_$/g, '') || 'tabla';
  }

  private slugify(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase()
      .replace(/^-|-$/g, '');
  }
}
