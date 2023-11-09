const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
(async () => {
    const blocoLink = 'https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=372'
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(blocoLink);
    const tableData = await page.evaluate(() => {
        const tables = document.querySelectorAll('table');
        const table = tables[tables.length - 1]
        const rows = table.querySelectorAll('tr');
        const data = [];
        rows.forEach(row => {
            const rowData = [];
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, i) => {
                if (i == 2) {
                    if (cell.querySelector("a")) {
                        rowData.push({ href: cell.querySelector("a").href, nome: cell.innerText })
                    }
                } else
                    rowData.push(cell.innerText);
            });
            data.push(rowData);
        });

        return data;
    });
    const registros = tableData
    for (let index = 0; index < registros.length; index++) {
        if (index == 0) continue
        const registro = registros[index];
        const registroLink = registro[2].href;
        const nomeRegistro = registro[2].nome;
        await page.goto(registroLink);
        const t2 = await page.evaluate(() => {
            const table = document.querySelector('table');
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
        });
        const linhasDoRegistro = t2
        const props = []
        for (let i = 0; i < linhasDoRegistro.length; i++) {
            if (i == 0) continue;
            const linha = linhasDoRegistro[i];
            if (linha.length < 7) continue;
            const posicao = linha[0]
            const propriedade = linha[1].replace(" ", "");
            const tamanho = linha[4]
            props.push({
                posicao, propriedade, tamanho
            })
        }
        const nome = `Registro_${nomeRegistro}`
        const entidade = gerarEntidade(nome, props)
        const repositorio = gerarRepositorio(nome)
        const teste = gerarTeste(nome)

        const arquivoEntidade = `${nome}.java`;
        fs.writeFileSync(arquivoEntidade, entidade, 'utf-8');
        const arquivoRepository = `${nome}Repository.java`;
        fs.writeFileSync(arquivoRepository, repositorio, 'utf-8');
        const arquivoTeste = `${nome}Tests.java`;
        fs.writeFileSync(arquivoTeste, teste, 'utf-8');

        const entidadePath = 'C:\\Users\\matheus.silva\\projects\\MSProcessEFDContribuicoes\\src\\main\\java\\br\\com\\certacon\\msprocessefdcontribuicoes\\domain\\entities';
        const repositorioPath = 'C:\\Users\\matheus.silva\\projects\\MSProcessEFDContribuicoes\\src\\main\\java\\br\\com\\certacon\\msprocessefdcontribuicoes\\data\\repositories';
        const testePath = 'C:\\Users\\matheus.silva\\projects\\MSProcessEFDContribuicoes\\src\\test\\java\\br\\com\\certacon\\msprocessefdcontribuicoes\\domain\\entities';

        const entidadeFilePath = path.join(entidadePath, arquivoEntidade);
        fs.renameSync(arquivoEntidade, entidadeFilePath);

        const repositorioFilePath = path.join(repositorioPath, arquivoRepository);
        fs.renameSync(arquivoRepository, repositorioFilePath);

        const testeFilePath = path.join(testePath, arquivoTeste);
        fs.renameSync(arquivoTeste, testeFilePath);
    }
    await browser.close();
})();
const gerarRepositorio = (nome) => `
package br.com.certacon.msprocessefdcontribuicoes.data.repositories;

import br.com.certacon.msprocessefdcontribuicoes.domain.entities.${nome};
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ${nome}Repository extends JpaRepository<${nome}, UUID> {
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
public class ${nomeClasse} extends Registro implements IRegistro {\n`;

    for (const objeto of propriedades) {
        const { propriedade } = objeto;
        javaCode += `    private String ${propriedade};\n`;
    }
    //c
    javaCode += `public ${nomeClasse}(String line){\n`
    javaCode += 'String[] data = splitLine(line);\n'
    let i = 0;
    for (const objeto of propriedades) {
        const { propriedade } = objeto;
        javaCode += `this.${propriedade} = data[${i}];\n`;
        i++;
    }
    javaCode += "}";
    //toS
    javaCode += 'public String toString(){\n'
    javaCode += 'String str =  String.join("|",\n'
    i = 0;
    for (const objeto of propriedades) {
        i++;
        const { propriedade } = objeto;
        const isLast = i == propriedades.length;
        javaCode += `this.${propriedade}${isLast ? ");" : ","}\n`;
    }
    javaCode += 'return "|"+str+"|";\n'
    javaCode += "}";
    javaCode += '}';

    return javaCode;
}
