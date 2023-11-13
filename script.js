const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const blocos = [
    { nome: '0', link: 'https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=372', skip: false },
    { nome: '1', link: 'https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=563', skip: false },
    { nome: 'A', link: 'https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=371', skip: false },
    { nome: 'C', link: 'https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=381', skip: false },
    { nome: 'D ', link: 'https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=558', skip: false },
    { nome: 'F', link: 'https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=559', skip: false },
    { nome: 'I', link: 'https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=560', skip: false },
    { nome: 'M', link: 'https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=561', skip: false },
    { nome: 'P', link: 'https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=562', skip: false },
    { nome: '9', link: 'https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=226', skip: false },

];
(async () => {
    console.log("Pulando " + blocos.filter(e => e.skip).length + " blocos, processando " + blocos.filter(e => !e.skip).length)
    const registrosCriados = []
    for (let blocoIndex = 0; blocoIndex < blocos.length; blocoIndex++) {
        const b = blocos[blocoIndex];
        if (b.skip) {
            console.log('Pulando bloco ' + b.nome)
            continue;
        };
        const blocoLink = b.link
        console.log("Iniciando bloco " + b.nome)
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.goto(blocoLink);
        const tableData = await page.evaluate((bloco) => {
            const tables = document.querySelectorAll('table');
            let i = [0]
            if (bloco == "F" || bloco == "I" || bloco == "P") {
                i = 1
            }
            const table = tables[i]
            const rows = table.querySelectorAll('tr');
            const data = [];
            rows.forEach(row => {
                const rowData = [];
                const cells = row.querySelectorAll('td');
                cells.forEach((cell, i) => {
                    if(bloco == "9" && i==1){
                        rowData.push({ href: cell.querySelector("a").href, nome: cell.innerText })
                        return;
                    }
                    if (i == 2 && bloco !== "9") {
                        if (cell.querySelector("a"))
                            rowData.push({ href: cell.querySelector("a").href, nome: cell.innerText })

                    } else
                        rowData.push(cell.innerText);
                });
                data.push(rowData);
            });

            return data;
        }, b.nome);
        const registros = tableData
        for (let index = 0; index < registros.length; index++) {
            const registro = registros[index];
            if (registro.length == 0) continue
            let registroLink = null;
            let nomeRegistro = null;
            if (registro[0] == "F" && registro[1] == "Identificação do Estabelecimento") {
                registroLink = "https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=732"
                nomeRegistro = "F010"
            }else
            if(registro[0] == "9"){
                registroLink = registro[1].href;
                nomeRegistro = registro[2];
            }
            else {
                registroLink = registro[2].href;
                nomeRegistro = registro[2].nome.replace(" (*)", "");
            }
            await page.goto(registroLink);
            const t2 = await page.evaluate((nomeRegistro) => {
                const tables = document.querySelectorAll('table');
                let i = 0;
                if (nomeRegistro == "1101" || nomeRegistro == "1501") {
                    i = 1;
                }
                const table = tables[i]
                const rows = table.querySelectorAll('tr');
                const data = [];
                rows.forEach(row => {
                    const rowData = [];
                    const cells = row.querySelectorAll('td');
                    cells.forEach((cell, i) => {
                        rowData.push(cell.innerText);
                    });
                    data.push(rowData);
                });

                return data;
            }, nomeRegistro);
            const linhasDoRegistro = t2
            const props = []
            for (let i = 0; i < linhasDoRegistro.length; i++) {
                if (i == 0) continue;
                const linha = linhasDoRegistro[i];
                if (linha.length < 7 && linha.length < 5) continue;
                const posicao = linha[0]
                let propriedade = linha[1].replace(" ", "").replace("-", "");
                if (propriedade == "02")
                    propriedade = "DOIS"
                if (propriedade == "END")
                    propriedade = "ENDE"
                const tamanhoStr = linha[4]
                let tamanho = {
                    min: 0,
                    max: null
                }
                let obrigatorio = true;
                if (linha.length >= 7) {
                    obrigatorio = linha[6] == "S" || linha[6].length == 0
                }
                if (tamanhoStr.includes("*")) {
                    tamanho.min = + tamanhoStr.replace("*")
                } else {
                    tamanho.max = + tamanhoStr.replace("*")
                    tamanho.max = + tamanhoStr.replace("*")
                }
                props.push({
                    posicao, propriedade, tamanho, obrigatorio
                })
            }
            if (props.length == 0) {
                console.log("!!!!!!!!!!!!!! Erro no " + nomeRegistro, registroLink);
                continue;
            }
            const nome = `Registro_${nomeRegistro}`
            const entidade = gerarEntidade(nome, props)
            const repositorio = gerarRepositorio(nome)
            const teste = gerarTeste(nome)
            const entidadeDados = gerarModeloDeDadosEntidade(nome, props);

            const arquivoEntidade = `${nome}.java`;
            fs.writeFileSync(arquivoEntidade, entidade, 'utf-8');
            const arquivoRepository = `${nome}Repository.java`;
            fs.writeFileSync(arquivoRepository, repositorio, 'utf-8');
            const arquivoTeste = `${nome}Tests.java`;
            fs.writeFileSync(arquivoTeste, teste, 'utf-8');
            const arquivoEntidadeDados = `${nome}Entity.java`;
            fs.writeFileSync(arquivoEntidadeDados, entidadeDados, 'utf-8');

            const entidadePath = 'C:\\Users\\matheus.silva\\projects\\MSProcessEFDContribuicoes\\src\\main\\java\\br\\com\\certacon\\msprocessefdcontribuicoes\\domain\\entities';
            const repositorioPath = 'C:\\Users\\matheus.silva\\projects\\MSProcessEFDContribuicoes\\src\\main\\java\\br\\com\\certacon\\msprocessefdcontribuicoes\\data\\repositories';
            const testePath = 'C:\\Users\\matheus.silva\\projects\\MSProcessEFDContribuicoes\\src\\test\\java\\br\\com\\certacon\\msprocessefdcontribuicoes\\domain\\entities';
            const entidadeDadosPath = 'C:\\Users\\matheus.silva\\projects\\MSProcessEFDContribuicoes\\src\\main\\java\\br\\com\\certacon\\msprocessefdcontribuicoes\\data\\entities'

            const entidadeFilePath = path.join(entidadePath, arquivoEntidade);
            fs.renameSync(arquivoEntidade, entidadeFilePath);

            const repositorioFilePath = path.join(repositorioPath, arquivoRepository);
            fs.renameSync(arquivoRepository, repositorioFilePath);

            const testeFilePath = path.join(testePath, arquivoTeste);
            fs.renameSync(arquivoTeste, testeFilePath);

            const entidadeDadosFilePath = path.join(entidadeDadosPath, arquivoEntidadeDados);
            fs.renameSync(arquivoEntidadeDados, entidadeDadosFilePath);
            registrosCriados.push(nomeRegistro)
            console.log("Arquivos do registro " + nomeRegistro + " criados com sucesso");

        }
    }
    console.log("Processado " + blocos.filter(e => !e.skip).length + " blocos com sucesso")
    console.log('Iniciando criação de serviço')
    const servico = gerarServico(registrosCriados)
    const servicoPath = "C:\\Users\\matheus.silva\\projects\\MSProcessEFDContribuicoes\\src\\main\\java\\br\\com\\certacon\\msprocessefdcontribuicoes\\domain\\services\\processEFDCService"
    const servicoFile = "ProcessEFDCHandler.java";
    const servicoFilePath = path.join(servicoPath, servicoFile)
    fs.writeFileSync(servicoFile, servico, 'utf-8');
    fs.renameSync(servicoFile, servicoFilePath);
    console.log('Servico criado com sucesso')

})();
const gerarRepositorio = (nome) => `
package br.com.certacon.msprocessefdcontribuicoes.data.repositories;

import br.com.certacon.msprocessefdcontribuicoes.data.entities.${nome}Entity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ${nome}Repository extends JpaRepository<${nome}Entity, UUID> {
}
`
const gerarTeste = (nome) => `
package br.com.certacon.msprocessefdcontribuicoes.domain.entities;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class ${nome}Tests {
    @Test
    public void when${nome}CorrectLineMountCorrect${nome}Entity() {
        String line = "PUT_CORRECT_LINE";
        var entity = new ${nome}(line);
        String actual = entity.toString();
        String expected = line;
        assertEquals(expected, actual);
    }
}

`
function gerarEntidade(nomeClasse, propriedades) {
    let javaCode = `
package br.com.certacon.msprocessefdcontribuicoes.domain.entities;

import br.com.certacon.msprocessefdcontribuicoes.domain.entities.IRegistro;
import br.com.certacon.msprocessefdcontribuicoes.domain.entities.Registro;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ${nomeClasse} extends Registro implements IRegistro {\n`;

    for (const objeto of propriedades) {
        const { propriedade, obrigatorio } = objeto;
        if (obrigatorio)
            javaCode += "@NotNull\n"
        javaCode += `private String ${propriedade};\n`;
    }
    //c
    javaCode += `public ${nomeClasse}(String line){\n`
    javaCode += 'String[] data = splitLine(line);\n'
    let i = 0;
    for (const objeto of propriedades) {
        const { propriedade, obrigatorio } = objeto;
        if (!obrigatorio)
            javaCode += `if(data.length >= ${i + 1})\n`;

        javaCode += `this.${propriedade} = data[${i}];\n`;
        i++;
    }
    javaCode += "}";
    //toS
    javaCode += '       public String toString(){\n'
    javaCode += '           String str =  String.join("|",\n'
    i = 0;
    for (const objeto of propriedades) {
        i++;
        const { propriedade } = objeto;
        const isLast = i == propriedades.length;
        javaCode += `       this.${propriedade}${isLast ? ");" : ","}\n`;
    }
    javaCode += '           return "|"+str+"|";\n'
    javaCode += "       }";
    javaCode += '}';

    return javaCode;
}
function gerarModeloDeDadosEntidade(nomeClasse, propriedades) {
    let javaCode = `
package br.com.certacon.msprocessefdcontribuicoes.data.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "${nomeClasse.toUpperCase()}")
public class ${nomeClasse}Entity {\n
    
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "ID", updatable = false, unique = true, nullable = false)
    private UUID id;
    @DateTimeFormat(pattern = "MM/dd/yyyy")
    @Column(name = "ATUALIZADO_EM")
    private LocalDateTime atualizadoEm;

    @DateTimeFormat(pattern = "MM/dd/yyyy")
    @Column(name = "CRIADO_EM", nullable = false)
    private LocalDateTime criadoEm = LocalDateTime.now();    

`;
    for (const objeto of propriedades) {
        const { propriedade, obrigatorio } = objeto;
        javaCode += `@Column(name="${propriedade}"${obrigatorio ? ',nullable=false' : ''})\n`;
        javaCode += `private String ${propriedade};\n`;
    }
    javaCode += '}';

    return javaCode;
}
function gerarServico(registros) {
    let javaCode = `
    package br.com.certacon.msprocessefdcontribuicoes.domain.services.processEFDCService;

    import br.com.certacon.msprocessefdcontribuicoes.data.entities.*;
    import br.com.certacon.msprocessefdcontribuicoes.data.repositories.*;
    import br.com.certacon.msprocessefdcontribuicoes.domain.entities.*;
    import br.com.certacon.msprocessefdcontribuicoes.data.enums.ELinhaStatus;

    import org.springframework.beans.BeanUtils;
    import org.springframework.beans.factory.annotation.Autowired;
    import org.springframework.stereotype.Service;

    import java.util.List;

    @Service
    public class ProcessEFDCHandler {
        @Autowired
        private LinhaRepository linhaRepository;
        `
    for (const registro of registros) {
        javaCode += `@Autowired\n`;
        javaCode += `private Registro_${registro}Repository registro_${registro}Repository;\n`;
    }
    javaCode += `
        public ProcessEFDCResponse handle(ProcessEFDCRequest request) {
            List<LinhaEntity> linhas = linhaRepository.getByIdArquivo(request.idArquivo());
            for (LinhaEntity linha : linhas) {
                String reg = linha.getConteudoLinha().substring(0, 6).replace("|","");
                switch(reg){

`;
    for (const registro of registros) {
        javaCode += `case "${registro}":\n`;
        javaCode += `try{\n`;
        javaCode += `createRegistro_${registro}(linha);\n`;
        javaCode += `}catch(Exception e){
            linha.setStatus(ELinhaStatus.ERRO_CONVERSAO_REGISTRO);
            linhaRepository.save(linha);
        }
            `;

        javaCode += `break;\n`;
    }
    javaCode += `
    default:
        linha.setStatus(ELinhaStatus.REGISTRO_NAO_ENCONTRADO);
        linhaRepository.save(linha);
        break;
}

}
return new ProcessEFDCResponse(true);
}
`
    for (const registro of registros) {
        javaCode += `public void createRegistro_${registro}(LinhaEntity linha){\n`;
        javaCode += `Registro_${registro} entity = new Registro_${registro}(linha.getConteudoLinha());\n`;
        javaCode += `Registro_${registro}Entity dataEntity = new Registro_${registro}Entity();\n`;
        javaCode += `BeanUtils.copyProperties(entity, dataEntity);\n`;
        javaCode += `registro_${registro}Repository.save(dataEntity);\n`;
        javaCode += `linha.setIdRegistro(dataEntity.getId());\n`;
        javaCode += `linha.setStatus(ELinhaStatus.REGISTRO_VALIDO);\n`;
        javaCode += `linhaRepository.save(linha);\n`;
        javaCode += `}`;

    }
    javaCode += `
}
    `;

    return javaCode;
}