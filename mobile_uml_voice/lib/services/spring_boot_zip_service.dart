import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/uml_models.dart';
import 'download_helper.dart';

class BackendHistoryItem {
  final String id;
  final String projectName;
  final String ownerId;
  final DateTime generatedAt;
  final int classesCount;
  final int relationsCount;
  final List<String> classNames;

  BackendHistoryItem({
    required this.id,
    required this.projectName,
    required this.ownerId,
    required this.generatedAt,
    required this.classesCount,
    required this.relationsCount,
    required this.classNames,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'projectName': projectName,
    'ownerId': ownerId,
    'generatedAt': generatedAt.toIso8601String(),
    'classesCount': classesCount,
    'relationsCount': relationsCount,
    'classNames': classNames,
  };

  factory BackendHistoryItem.fromJson(Map<String, dynamic> json) => BackendHistoryItem(
    id: json['id'] ?? '',
    projectName: json['projectName'] ?? 'backend',
    ownerId: json['ownerId'] ?? '',
    generatedAt: json['generatedAt'] != null ? DateTime.tryParse(json['generatedAt']) ?? DateTime.now() : DateTime.now(),
    classesCount: json['classesCount'] ?? 0,
    relationsCount: json['relationsCount'] ?? 0,
    classNames: (json['classNames'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
  );
}

class ZipFileEntry {
  final String path;
  final List<int> bytes;

  ZipFileEntry({required this.path, required this.bytes});

  factory ZipFileEntry.fromString(String path, String content) {
    return ZipFileEntry(path: path, bytes: utf8.encode(content));
  }
}

/// Generador de Backend Spring Boot 3 + PostgreSQL + Postman y Empaquetador ZIP en memoria
class SpringBootZipService {
  // Tabla precalculada CRC32 estándar IEEE 802.3
  static final Uint32List _crcTable = _initCrcTable();

  static Uint32List _initCrcTable() {
    final table = Uint32List(256);
    for (int i = 0; i < 256; i++) {
      int c = i;
      for (int k = 0; k < 8; k++) {
        c = (c & 1) != 0 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    return table;
  }

  static int _calculateCrc32(List<int> data) {
    int crc = 0xFFFFFFFF;
    for (int byte in data) {
      crc = _crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /// Construye un archivo .ZIP estándar en bytes usando el estándar PKZip
  static Uint8List createZip(List<ZipFileEntry> files) {
    final now = DateTime.now();
    final dosTime = (now.hour << 11) | (now.minute << 5) | (now.second >> 1);
    final dosDate = ((now.year - 1980) << 9) | (now.month << 5) | now.day;

    final localHeaders = <Uint8List>[];
    final cdHeaders = <Uint8List>[];
    int currentOffset = 0;

    for (final file in files) {
      final normPath = file.path.replaceAll('\\', '/').replaceAll(RegExp(r'^/'), '');
      final pathBytes = utf8.encode(normPath);
      final dataBytes = file.bytes;
      final crc = _calculateCrc32(dataBytes);
      final dataLength = dataBytes.length;

      // 1. Local File Header (30 bytes + path + data)
      final localHeader = Uint8List(30 + pathBytes.length + dataLength);
      final lv = ByteData.sublistView(localHeader);

      lv.setUint32(0, 0x04034b50, Endian.little); // Firma PK\x03\x04
      lv.setUint16(4, 20, Endian.little);         // Version needed (2.0)
      lv.setUint16(6, 0x0800, Endian.little);     // Flags (UTF-8 filename)
      lv.setUint16(8, 0, Endian.little);          // Compression method: 0 (Store)
      lv.setUint16(10, dosTime, Endian.little);
      lv.setUint16(12, dosDate, Endian.little);
      lv.setUint32(14, crc, Endian.little);
      lv.setUint32(18, dataLength, Endian.little); // Comp size
      lv.setUint32(22, dataLength, Endian.little); // Uncomp size
      lv.setUint16(26, pathBytes.length, Endian.little);
      lv.setUint16(28, 0, Endian.little);

      localHeader.setRange(30, 30 + pathBytes.length, pathBytes);
      localHeader.setRange(30 + pathBytes.length, 30 + pathBytes.length + dataLength, dataBytes);
      localHeaders.add(localHeader);

      // 2. Central Directory Header (46 bytes + path)
      final cdHeader = Uint8List(46 + pathBytes.length);
      final cv = ByteData.sublistView(cdHeader);

      cv.setUint32(0, 0x02014b50, Endian.little); // Firma PK\x01\x02
      cv.setUint16(4, 20, Endian.little);         // Version made by
      cv.setUint16(6, 20, Endian.little);         // Version needed
      cv.setUint16(8, 0x0800, Endian.little);     // Flags (UTF-8)
      cv.setUint16(10, 0, Endian.little);         // Compression: 0
      cv.setUint16(12, dosTime, Endian.little);
      cv.setUint16(14, dosDate, Endian.little);
      cv.setUint32(16, crc, Endian.little);
      cv.setUint32(20, dataLength, Endian.little);
      cv.setUint32(24, dataLength, Endian.little);
      cv.setUint16(28, pathBytes.length, Endian.little);
      cv.setUint16(30, 0, Endian.little);
      cv.setUint16(32, 0, Endian.little);
      cv.setUint16(34, 0, Endian.little);
      cv.setUint16(36, 0, Endian.little);
      cv.setUint32(38, 0, Endian.little);
      cv.setUint32(42, currentOffset, Endian.little); // Relative offset of local header

      cdHeader.setRange(46, 46 + pathBytes.length, pathBytes);
      cdHeaders.add(cdHeader);

      currentOffset += localHeader.length;
    }

    final cdOffset = currentOffset;
    int cdSize = 0;
    for (final h in cdHeaders) {
      cdSize += h.length;
    }

    // 3. End of Central Directory Record (22 bytes)
    final eocd = Uint8List(22);
    final ev = ByteData.sublistView(eocd);
    ev.setUint32(0, 0x06054b50, Endian.little); // Firma PK\x05\x06
    ev.setUint16(4, 0, Endian.little);          // Disk number
    ev.setUint16(6, 0, Endian.little);          // Disk with CD
    ev.setUint16(8, files.length, Endian.little); // Disk entries
    ev.setUint16(10, files.length, Endian.little); // Total entries
    ev.setUint32(12, cdSize, Endian.little);
    ev.setUint32(16, cdOffset, Endian.little);
    ev.setUint16(20, 0, Endian.little);

    final totalSize = currentOffset + cdSize + 22;
    final zip = Uint8List(totalSize);
    int pos = 0;
    for (final h in localHeaders) {
      zip.setRange(pos, pos + h.length, h);
      pos += h.length;
    }
    for (final h in cdHeaders) {
      zip.setRange(pos, pos + h.length, h);
      pos += h.length;
    }
    zip.setRange(pos, pos + 22, eocd);

    return zip;
  }

  /// Genera y descarga el proyecto Spring Boot completo en formato ZIP
  static Future<bool> generateAndDownloadZip(UmlDiagram diagram, {String? ownerId}) async {
    try {
      final safeName = diagram.name.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '-').replaceAll(RegExp(r'-+'), '-');
      final projectName = safeName.isEmpty ? 'backend-sistema' : safeName;
      final files = <ZipFileEntry>[];

      // 1. pom.xml
      files.add(ZipFileEntry.fromString('pom.xml', _generatePomXml(projectName)));

      // 2. application.properties
      files.add(ZipFileEntry.fromString(
        'src/main/resources/application.properties',
        _generateApplicationProperties(projectName),
      ));

      // 3. schema.sql (DDL PostgreSQL)
      files.add(ZipFileEntry.fromString(
        'src/main/resources/schema.sql',
        _generateSchemaSql(diagram),
      ));

      // 4. Main Application
      files.add(ZipFileEntry.fromString(
        'src/main/java/com/sistema/SistemaApplication.java',
        _generateMainApp(),
      ));

      // 5. CORS Config
      files.add(ZipFileEntry.fromString(
        'src/main/java/com/sistema/config/CorsConfig.java',
        _generateCorsConfig(),
      ));

      // 6. Entidades, Repositorios, Servicios y Controladores
      for (final cls in diagram.classes) {
        final cName = _capitalize(cls.name);
        files.add(ZipFileEntry.fromString('src/main/java/com/sistema/model/$cName.java', _generateEntityClass(cls)));
        files.add(ZipFileEntry.fromString('src/main/java/com/sistema/repository/${cName}Repository.java', _generateRepositoryClass(cName)));
        files.add(ZipFileEntry.fromString('src/main/java/com/sistema/service/${cName}Service.java', _generateServiceClass(cName)));
        files.add(ZipFileEntry.fromString('src/main/java/com/sistema/controller/${cName}Controller.java', _generateControllerClass(cName)));
      }

      // 7. Colección Postman v2.1
      files.add(ZipFileEntry.fromString(
        'postman_collection.json',
        _generatePostmanCollection(diagram, projectName),
      ));

      // 8. README.md
      files.add(ZipFileEntry.fromString('README.md', _generateReadme(projectName, diagram)));

      // Empaquetar y descargar
      final zipBytes = createZip(files);
      final filename = '$projectName-springboot.zip';
      downloadBlobFile(filename, zipBytes);

      // Guardar en el historial del creador
      if (ownerId != null && ownerId.isNotEmpty) {
        await _saveToHistory(diagram, projectName, ownerId);
      }

      return true;
    } catch (e) {
      debugPrint('Error generando ZIP: $e');
      return false;
    }
  }

  /// Descarga solo el script DDL PostgreSQL (schema.sql)
  static void downloadSchemaSql(UmlDiagram diagram) {
    final safeName = diagram.name.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '-');
    final projectName = safeName.isEmpty ? 'backend' : safeName;
    final sql = _generateSchemaSql(diagram);
    downloadBlobFile('$projectName-schema.sql', utf8.encode(sql));
  }

  /// Descarga solo la colección Postman v2.1
  static void downloadPostmanCollection(UmlDiagram diagram) {
    final safeName = diagram.name.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '-');
    final projectName = safeName.isEmpty ? 'backend' : safeName;
    final json = _generatePostmanCollection(diagram, projectName);
    downloadBlobFile('$projectName-postman.json', utf8.encode(json));
  }

  static const String _historyKey = 'case_generated_backends_history_mobile';

  static Future<void> _saveToHistory(UmlDiagram diagram, String projectName, String ownerId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final currentList = await getHistory(ownerId);
      final newItem = BackendHistoryItem(
        id: 'hist_${DateTime.now().millisecondsSinceEpoch}',
        projectName: diagram.name,
        ownerId: ownerId,
        generatedAt: DateTime.now(),
        classesCount: diagram.classes.length,
        relationsCount: diagram.relations.length,
        classNames: diagram.classes.map((c) => c.name).toList(),
      );

      final updated = [newItem, ...currentList.where((x) => x.id != newItem.id)].take(25).toList();
      final rawList = updated.map((x) => jsonEncode(x.toJson())).toList();
      await prefs.setStringList(_historyKey, rawList);
    } catch (e) {
      debugPrint('Error guardando en historial de backends: $e');
    }
  }

  /// Obtiene el historial visible ÚNICAMENTE para el creador/dueño
  static Future<List<BackendHistoryItem>> getHistory(String currentUserId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rawList = prefs.getStringList(_historyKey) ?? [];
      final list = rawList
          .map((str) => BackendHistoryItem.fromJson(jsonDecode(str)))
          .where((item) => item.ownerId == currentUserId) // Solo el creador puede visualizar
          .toList();
      return list;
    } catch (e) {
      debugPrint('Error cargando historial de backends: $e');
      return [];
    }
  }

  static String _capitalize(String s) {
    if (s.isEmpty) return '';
    return s[0].toUpperCase() + s.substring(1);
  }

  static String _generatePomXml(String projectName) {
    return '''<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
        <relativePath/>
    </parent>
    <groupId>com.sistema</groupId>
    <artifactId>$projectName</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <name>$projectName</name>
    <description>Backend API REST generado automáticamente desde Diagrama UML</description>

    <properties>
        <java.version>17</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>2.2.0</version>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>''';
  }

  static String _generateApplicationProperties(String projectName) {
    return '''# ==========================================
# Configuración del Backend Spring Boot 3
# Generado automáticamente por CASE Studio UML
# ==========================================
spring.application.name=$projectName
server.port=8080

# PostgreSQL Data Source
spring.datasource.url=jdbc:postgresql://localhost:5432/${projectName.replaceAll('-', '_')}
spring.datasource.username=postgres
spring.datasource.password=postgres
spring.datasource.driver-class-name=org.postgresql.Driver

# JPA & Hibernate
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect

# Swagger OpenAPI UI
springdoc.swagger-ui.path=/swagger-ui.html
springdoc.api-docs.path=/v3/api-docs
''';
  }

  static String _generateSchemaSql(UmlDiagram diagram) {
    final sb = StringBuffer();
    sb.writeln('-- ========================================================');
    sb.writeln('-- Script DDL para PostgreSQL - ${diagram.name}');
    sb.writeln('-- ========================================================\n');

    for (final cls in diagram.classes) {
      final tName = cls.name.toLowerCase();
      sb.writeln('CREATE TABLE IF NOT EXISTS $tName (');
      final colDefs = <String>[];
      for (final attr in cls.attributes) {
        String sqlType = 'VARCHAR(255)';
        final t = attr.type.toLowerCase();
        if (t == 'long' || t == 'id') sqlType = 'BIGSERIAL';
        else if (t == 'integer' || t == 'int') sqlType = 'INTEGER';
        else if (t == 'double' || t == 'decimal') sqlType = 'NUMERIC(12,2)';
        else if (t == 'boolean' || t == 'bool') sqlType = 'BOOLEAN';
        else if (t == 'localdate' || t == 'date') sqlType = 'DATE';

        String col = '    ${attr.name.toLowerCase()} $sqlType';
        if (attr.isPrimaryKey) col += ' PRIMARY KEY';
        else if (!attr.isNullable) col += ' NOT NULL';
        colDefs.add(col);
      }
      if (colDefs.isEmpty) {
        colDefs.add('    id BIGSERIAL PRIMARY KEY');
      }
      sb.writeln(colDefs.join(',\n'));
      sb.writeln(');\n');
    }

    return sb.toString();
  }

  static String _generateMainApp() {
    return '''package com.sistema;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class SistemaApplication {
    public static void main(String[] args) {
        SpringApplication.run(SistemaApplication.class, args);
    }
}''';
  }

  static String _generateCorsConfig() {
    return '''package com.sistema.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins("*")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*");
            }
        };
    }
}''';
  }

  static String _generateEntityClass(UmlClass cls) {
    final cName = _capitalize(cls.name);
    final sb = StringBuffer();
    sb.writeln('package com.sistema.model;\n');
    sb.writeln('import jakarta.persistence.*;');
    sb.writeln('import java.time.LocalDate;\n');
    sb.writeln('@Entity');
    sb.writeln('@Table(name = "${cls.name.toLowerCase()}")');
    sb.writeln('public class $cName {');

    for (final attr in cls.attributes) {
      if (attr.isPrimaryKey) {
        sb.writeln('    @Id');
        sb.writeln('    @GeneratedValue(strategy = GenerationType.IDENTITY)');
      }
      sb.writeln('    private ${attr.type} ${attr.name};');
    }

    // Default constructor
    sb.writeln('\n    public $cName() {}');

    // Getters and Setters
    for (final attr in cls.attributes) {
      final aCap = _capitalize(attr.name);
      sb.writeln('\n    public ${attr.type} get$aCap() { return this.${attr.name}; }');
      sb.writeln('    public void set$aCap(${attr.type} ${attr.name}) { this.${attr.name} = ${attr.name}; }');
    }

    sb.writeln('}');
    return sb.toString();
  }

  static String _generateRepositoryClass(String cName) {
    return '''package com.sistema.repository;

import com.sistema.model.$cName;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ${cName}Repository extends JpaRepository<$cName, Long> {
}''';
  }

  static String _generateServiceClass(String cName) {
    final varName = cName[0].toLowerCase() + cName.substring(1);
    return '''package com.sistema.service;

import com.sistema.model.$cName;
import com.sistema.repository.${cName}Repository;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class ${cName}Service {
    private final ${cName}Repository repository;

    public ${cName}Service(${cName}Repository repository) {
        this.repository = repository;
    }

    public List<$cName> findAll() {
        return repository.findAll();
    }

    public Optional<$cName> findById(Long id) {
        return repository.findById(id);
    }

    public $cName save($cName entity) {
        return repository.save(entity);
    }

    public void deleteById(Long id) {
        repository.deleteById(id);
    }
}''';
  }

  static String _generateControllerClass(String cName) {
    final varName = cName[0].toLowerCase() + cName.substring(1);
    final endpoint = cName.toLowerCase() + 's';
    return '''package com.sistema.controller;

import com.sistema.model.$cName;
import com.sistema.service.${cName}Service;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/$endpoint")
public class ${cName}Controller {
    private final ${cName}Service service;

    public ${cName}Controller(${cName}Service service) {
        this.service = service;
    }

    @GetMapping
    public List<$cName> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<$cName> getById(@PathVariable Long id) {
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public $cName create(@RequestBody $cName entity) {
        return service.save(entity);
    }

    @PutMapping("/{id}")
    public ResponseEntity<$cName> update(@PathVariable Long id, @RequestBody $cName entity) {
        if (!service.findById(id).isPresent()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(service.save(entity));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}''';
  }

  static String _generatePostmanCollection(UmlDiagram diagram, String projectName) {
    final items = <Map<String, dynamic>>[];
    for (final cls in diagram.classes) {
      final endpoint = cls.name.toLowerCase() + 's';
      items.add({
        'name': 'Listar ${cls.name}',
        'request': {
          'method': 'GET',
          'header': [],
          'url': {
            'raw': 'http://localhost:8080/api/$endpoint',
            'protocol': 'http',
            'host': ['localhost'],
            'port': '8080',
            'path': ['api', endpoint]
          }
        }
      });
      items.add({
        'name': 'Crear ${cls.name}',
        'request': {
          'method': 'POST',
          'header': [{'key': 'Content-Type', 'value': 'application/json'}],
          'body': {
            'mode': 'raw',
            'raw': jsonEncode({for (var a in cls.attributes) a.name: a.type == 'String' ? 'Ejemplo' : (a.type == 'Long' || a.type == 'Integer' ? 1 : true)})
          },
          'url': {
            'raw': 'http://localhost:8080/api/$endpoint',
            'protocol': 'http',
            'host': ['localhost'],
            'port': '8080',
            'path': ['api', endpoint]
          }
        }
      });
    }

    final collection = {
      'info': {
        '_postman_id': 'col_${DateTime.now().millisecondsSinceEpoch}',
        'name': '$projectName API',
        'schema': 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      'item': items
    };

    return const JsonEncoder.withIndent('  ').convert(collection);
  }

  static String _generateReadme(String projectName, UmlDiagram diagram) {
    return '''# $projectName - Backend Spring Boot 3 API REST

Generado automáticamente desde la plataforma CASE Studio UML Móvil / Web.

## 🚀 Requisitos
- Java 17+
- Maven 3.8+
- PostgreSQL 14+

## ⚙️ Configuración y Ejecución
1. Crear base de datos en PostgreSQL:
```sql
CREATE DATABASE ${projectName.replaceAll('-', '_')};
```
2. Ejecutar el script DDL `src/main/resources/schema.sql`
3. Iniciar el servidor:
```bash
./mvnw spring-boot:run
```
4. Documentación interactiva Swagger:
`http://localhost:8080/swagger-ui.html`
''';
  }
}
