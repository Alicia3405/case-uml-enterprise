import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UmlClass, UmlRelation } from '../../models/uml.models';
import { 
  SpringBootGeneratorService, 
  GeneratedProjectFiles, 
  GeneratedBackendHistoryItem 
} from '../../services/spring-boot-generator.service';

@Component({
  selector: 'app-backend-export-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './backend-export-modal.component.html',
  styleUrl: './backend-export-modal.component.css'
})
export class BackendExportModalComponent implements OnInit {
  private generatorService = inject(SpringBootGeneratorService);

  // Inputs desde el workspace
  classes = input<UmlClass[]>([]);
  relations = input<UmlRelation[]>([]);
  projectName = input<string>('sistema-backend');
  projectId = input<string>('');
  ownerId = input<string>('');
  canDownload = input<boolean>(true);
  isOwner = input<boolean>(true);

  // Evento de cierre
  close = output<void>();

  // Estados reactivos
  generated = signal<GeneratedProjectFiles | null>(null);
  selectedFile = signal<{ path: string; content: string } | null>(null);
  activeTab = signal<'CODE' | 'POSTMAN' | 'SCHEMA' | 'HISTORY'>('CODE');
  isBuildingZip = signal<boolean>(false);
  copied = signal<boolean>(false);

  // Historial privado: solo visible para el Dueño del proyecto
  history = signal<GeneratedBackendHistoryItem[]>([]);
  filteredHistory = () => {
    const isOwn = this.isOwner();
    const oid = this.ownerId();
    if (!isOwn) return [];
    return this.generatorService.history().filter(h => !h.ownerId || h.ownerId === oid);
  };

  ngOnInit(): void {
    this.generarArchivos();
  }

  generarArchivos(): void {
    const cls = this.classes();
    const rel = this.relations();
    const name = this.projectName() || 'sistema-backend';

    const result = this.generatorService.generateProject(cls, rel, name);
    this.generated.set(result);

    // Seleccionar por defecto la primera entidad o pom.xml
    if (result.entityFiles.length > 0) {
      this.selectedFile.set({
        path: result.entityFiles[0].path,
        content: result.entityFiles[0].content
      });
    } else {
      this.selectedFile.set({
        path: 'pom.xml',
        content: result.pomXml
      });
    }
  }

  selectFile(path: string, content: string): void {
    this.selectedFile.set({ path, content });
    this.copied.set(false);
  }

  copyCode(): void {
    const file = this.selectedFile();
    if (!file || typeof navigator === 'undefined') return;
    navigator.clipboard.writeText(file.content).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  async descargarProyectoZip(): Promise<void> {
    if (!this.canDownload()) return;
    const gen = this.generated();
    if (!gen) return;

    this.isBuildingZip.set(true);
    try {
      const blob = await this.generatorService.buildZipArchive(
        gen, 
        this.classes(), 
        this.relations(),
        this.ownerId(),
        this.projectId()
      );
      const filename = `${gen.projectName}-springboot-postgres.zip`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.isBuildingZip.set(false);
      }, 250);
    } catch (e) {
      console.error('Error al empaquetar ZIP:', e);
      this.isBuildingZip.set(false);
    }
  }

  descargarPostmanSolo(): void {
    if (!this.canDownload()) return;
    const gen = this.generated();
    if (!gen) return;
    this.generatorService.downloadPostmanCollection(gen.postmanCollectionJson, gen.projectName);
  }

  descargarSqlSolo(): void {
    if (!this.canDownload()) return;
    const gen = this.generated();
    if (!gen) return;
    this.generatorService.downloadSchemaSql(gen.schemaSql, gen.projectName);
  }

  reDescargarPostmanDesdeHistorial(item: GeneratedBackendHistoryItem): void {
    this.generatorService.downloadPostmanCollection(item.postmanJson, item.projectName);
  }

  reDescargarSqlDesdeHistorial(item: GeneratedBackendHistoryItem): void {
    this.generatorService.downloadSchemaSql(item.schemaSql, item.projectName);
  }

  cerrar(): void {
    this.close.emit();
  }
}
