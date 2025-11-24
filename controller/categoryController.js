/**
 * 分类控制器模块
 * 负责处理分类相关的所有操作，包括分类的创建、查询、更新和删除，
 * 以及与电影关联的分类操作
 */
const Category = require('../models/category'); // 分类模型
const Movie = require('../models/movie');       // 电影模型

/**
 * 获取分类列表
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @returns {void} 渲染分类管理页面
 */
exports.getCategories = async (req, res) => {
    try {
        // 查询所有分类数据
        const categories = await Category.find().exec();
        
        // 渲染分类管理页面，传入分类数据
        res.render('categories', {
            title: '分类管理',
            categories
        });
    } catch (error) {
        console.error('获取分类列表失败:', error);
        res.status(500).render('error', {
            message: '获取分类列表失败',
            error
        });
    }
}

/**
 * 删除分类
 * @param {Object} req - Express请求对象，包含查询参数id
 * @param {Object} res - Express响应对象
 * @returns {Object} JSON响应，成功时返回{success:1}
 */
exports.delcategory = async (req, res) => {
    try {
        // 从查询参数中获取分类ID
        const { id } = req.query;
        
        // 执行删除操作
        await Category.deleteOne({ _id: id }).exec();
        
        // 返回成功响应
        res.json({ success: 1 });
    } catch (error) {
        console.error('删除分类失败:', error);
        res.json({ success: 0, message: '删除分类失败' });
    }
}

/**
 * 添加分类或为电影分配分类
 * @param {Object} req - Express请求对象，包含表单数据
 * @param {string} req.body.id - 电影ID（可选，用于为特定电影分配分类）
 * @param {string} req.body.inputcategory - 新分类名称（可选，可包含多个用逗号分隔的分类名）
 * @param {string} req.body.selectcategory - 已存在的分类名称（可选，用于为电影分配）
 * @param {Object} res - Express响应对象
 * @returns {Object} JSON响应，成功时返回{success:1}
 */
exports.addcategory = async (req, res) => {
    try {
        const { id, inputcategory, selectcategory } = req.body;
        
        // 如果提供了selectcategory，则为指定电影分配分类
        if (selectcategory && selectcategory !== '') {
            const movie = await Movie.findOne({ _id: id }).exec();
            if (movie) {
                movie.category = selectcategory;
                await movie.save();
            }
        }
        
        // 如果提供了inputcategory，则添加新的分类
        if (inputcategory && inputcategory !== '') {
            // 分割逗号分隔的分类名
            const categoryarr = inputcategory.split(',');
            // 构建分类对象数组
            const newcategoryarr = categoryarr.map(element => ({
                title: element.trim() // 去除分类名前后空白
            }));
            // 批量插入分类
            await Category.insertMany(newcategoryarr);
        }
        
        // 返回成功响应
        res.json({ success: 1 });
    } catch (error) {
        console.error('添加分类失败:', error);
        res.json({ success: 0, message: '添加分类失败' });
    }
}

/**
 * 编辑分类页面
 * @param {Object} req - Express请求对象，包含路径参数id
 * @param {Object} res - Express响应对象
 * @returns {void} 渲染分类编辑页面
 */
exports.editcategory = async (req, res) => {
    try {
        // 从路径参数中获取分类ID
        const { id } = req.params;
        
        // 查询分类信息
        const category = await Category.findOne({ _id: id }).exec();
        
        if (!category) {
            return res.status(404).render('error', {
                message: '分类不存在',
                error: { status: 404 }
            });
        }
        
        // 渲染编辑页面，传入分类数据
        res.render('editcategory', {
            title: `编辑分类 ${category.title}`,
            category
        });
    } catch (error) {
        console.error('获取分类编辑页面失败:', error);
        res.status(500).render('error', {
            message: '服务器内部错误',
            error
        });
    }
}

/**
 * 更新分类信息
 * @param {Object} req - Express请求对象，包含路径参数id和表单数据
 * @param {string} req.body.title - 新的分类名称
 * @param {string} req.body.antiurl - 反爬链接（可选）
 * @param {string} req.body.open - 打开方式设置（可选）
 * @param {Object} res - Express响应对象
 * @returns {void} 重定向到分类列表页面
 */
exports.posteditcategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, antiurl, open } = req.body;
        
        // 查询原始分类信息
        const category = await Category.findOne({ _id: id }).exec();
        
        if (!category) {
            return res.status(404).render('error', {
                message: '分类不存在',
                error: { status: 404 }
            });
        }
        
        // 更新所有使用该分类的电影
        if (title !== category.title) {
            await Movie.updateMany(
                { category: category.title },
                { $set: { category: title } }
            ).exec();
        }
        
        // 更新分类信息
        category.title = title;
        category.antiurl = antiurl;
        category.open = open;
        
        await category.save();
        
        // 重定向到分类列表页面
        res.redirect('/admin/categories');
    } catch (error) {
        console.error('更新分类失败:', error);
        res.status(500).render('error', {
            message: '更新分类失败',
            error
        });
    }
}

/**
 * 批量更新电影分类
 * @param {Object} req - Express请求对象，包含JSON格式的电影分类数据
 * @param {string} req.body.datas - JSON字符串，包含电影ID和对应分类的数组
 * @param {Object} res - Express响应对象
 * @returns {Object} JSON响应，成功时返回{success:1}
 */
exports.updatecategory = async (req, res) => {
    try {
        // 解析JSON格式的电影分类数据
        const { datas } = req.body;
        const datasjson = JSON.parse(datas);
        
        // 构建更新操作数组
        const updatePromises = datasjson.map(async element => {
            try {
                const movie = await Movie.findOne({ _id: element.id }).exec();
                if (movie) {
                    movie.category = element.category;
                    await movie.save();
                }
            } catch (err) {
                console.error(`更新电影ID ${element.id} 分类失败:`, err);
                // 继续处理其他电影，不中断整个流程
            }
        });
        
        // 并行执行所有更新操作
        await Promise.all(updatePromises);
        
        // 返回成功响应
        res.json({ success: 1 });
    } catch (error) {
        console.error('批量更新电影分类失败:', error);
        res.json({ success: 0, message: '批量更新失败' });
    }
}

/**
 * 为选中的电影批量设置分类
 * @param {Object} req - Express请求对象，包含选中的电影ID数组和目标分类
 * @param {Array<string>} req.body.idarr - 电影ID数组
 * @param {string} req.body.category - 要设置的分类名称
 * @param {Object} res - Express响应对象
 * @returns {Object} JSON响应，成功时返回{success:1}
 */
exports.selectedcategory = async (req, res) => {
    try {
        // 获取电影ID数组和目标分类
        const { idarr, category } = req.body;
        const ids = Array.isArray(idarr) ? idarr : [];
        
        // 构建更新操作数组
        const updatePromises = ids.map(async id => {
            try {
                const movie = await Movie.findOne({ _id: id }).exec();
                if (movie) {
                    movie.category = category;
                    await movie.save();
                }
            } catch (err) {
                console.error(`更新电影ID ${id} 分类失败:`, err);
                // 继续处理其他电影，不中断整个流程
            }
        });
        
        // 并行执行所有更新操作
        await Promise.all(updatePromises);
        
        // 返回成功响应
        res.json({ success: 1 });
    } catch (error) {
        console.error('批量设置电影分类失败:', error);
        res.json({ success: 0, message: '批量设置失败' });
    }
}